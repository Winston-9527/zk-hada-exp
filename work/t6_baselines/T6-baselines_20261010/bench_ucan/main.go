// T6 B1 (PREREGISTRATION.md Table 1): go-ucan (official, vendor/go-ucan @ 46ec5c69) delegation chain of D = 1..4 + one invocation.
// Only the official public API is called. Per sample: fresh Ed25519 keys; root delegation (iss = sub = root) then D-1 re-delegations with attenuating
// policy `.amount <= cap_i` and expiry; the holder invokes with amount = 1. Verifier: FromSealed of every token (signature check) + ExecutionAllowed.
// usage: go run . 30 > ../results/ucan_bench.json
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/ipfs/go-cid"
	"github.com/ipld/go-ipld-prime/node/basicnode"
	"github.com/ucan-wg/go-did-it"
	_ "github.com/ucan-wg/go-did-it/crypto/all" // algorithm registration, as in go-ucan's own tests
	_ "github.com/ucan-wg/go-did-it/verifiers/did-key"
	didkeyctl "github.com/ucan-wg/go-did-it/controller/did-key"
	"github.com/ucan-wg/go-did-it/crypto/ed25519"

	"github.com/ucan-wg/go-ucan/pkg/command"
	"github.com/ucan-wg/go-ucan/pkg/policy"
	"github.com/ucan-wg/go-ucan/token/delegation"
	"github.com/ucan-wg/go-ucan/token/invocation"
)

type loader map[cid.Cid]*delegation.Token

func (l loader) GetDelegation(c cid.Cid) (*delegation.Token, error) {
	if t, ok := l[c]; ok {
		return t, nil
	}
	return nil, delegation.ErrDelegationNotFound
}

type sample struct {
	D            int     `json:"D"`
	IssueMsTotal float64 `json:"issue_ms_total"`
	IssueMsEdge  float64 `json:"issue_ms_per_edge"`
	InvokeMs     float64 `json:"invoke_ms"`
	VerifyMs     float64 `json:"verify_ms"`
	Bytes        int     `json:"bytes_total"`
	InvBytes     int     `json:"invocation_bytes"`
	Accepted     bool    `json:"accepted"`
	OverspendRej bool    `json:"overspend_rejected"`
}

func ms(t time.Time) float64 { return float64(time.Since(t).Nanoseconds()) / 1e6 }
func must(err error) {
	if err != nil {
		panic(err)
	}
}

func run(D int, amount int64) sample {
	cmd, err := command.Parse("/agent/act")
	must(err)
	caps := []int64{1000, 500, 250, 125}
	keys := make([]ed25519.PrivateKey, D+1)
	dids := make([]did.DID, D+1)
	for i := range keys {
		_, k, err := ed25519.GenerateKeyPair()
		must(err)
		keys[i] = k
		dids[i] = didkeyctl.FromPrivateKey(k)
	}
	root := dids[0]
	s := sample{D: D}
	sealed := make([][]byte, D)
	cids := make([]cid.Cid, D)
	t := time.Now()
	for i := 0; i < D; i++ { // edge i: dids[i] -> dids[i+1], subject = root
		pol := policy.MustConstruct(policy.LessThanOrEqual(".amount", basicnode.NewInt(caps[i])))
		dl, err := delegation.New(dids[i], dids[i+1], cmd, pol, root, delegation.WithExpirationIn(time.Duration(4-i)*time.Hour))
		must(err)
		sealed[i], cids[i], err = dl.ToSealed(keys[i])
		must(err)
	}
	s.IssueMsTotal = ms(t)
	s.IssueMsEdge = s.IssueMsTotal / float64(D)
	prf := make([]cid.Cid, D) // invoker's proof first, root delegation last
	for i := 0; i < D; i++ {
		prf[i] = cids[D-1-i]
	}
	t = time.Now()
	inv, err := invocation.New(dids[D], cmd, root, prf, invocation.WithArgument("amount", basicnode.NewInt(amount)), invocation.WithExpirationIn(time.Minute))
	must(err)
	invSealed, _, err := inv.ToSealed(keys[D])
	must(err)
	s.InvokeMs = ms(t)
	// verifier: decode (signature verification) of everything, then the chain / time / policy checks
	t = time.Now()
	l := loader{}
	for i := 0; i < D; i++ {
		dt, c, err := delegation.FromSealed(sealed[i])
		must(err)
		l[c] = dt
	}
	it, _, err := invocation.FromSealed(invSealed)
	must(err)
	s.Accepted = it.ExecutionAllowed(l) == nil
	s.VerifyMs = ms(t)
	s.InvBytes = len(invSealed)
	s.Bytes = len(invSealed)
	for _, b := range sealed {
		s.Bytes += len(b)
	}
	return s
}

func main() {
	N, _ := strconv.Atoi(os.Args[1])
	out := map[string]any{"impl": "go-ucan 46ec5c698dec427af6823ee9337b203163538299", "go": "go1.27.2", "N": N, "warmup_per_D": 3}
	rows := []sample{}
	for D := 1; D <= 4; D++ {
		for w := 0; w < 3; w++ {
			run(D, 1)
		}
		for r := 0; r < N; r++ {
			s := run(D, 1)
			s.OverspendRej = !run(D, 100000).Accepted // sanity: amount above every cap must be rejected (separate fresh chain, not timed)
			rows = append(rows, s)
		}
	}
	out["rows"] = rows
	b, _ := json.Marshal(out)
	fmt.Println(string(b))
}
