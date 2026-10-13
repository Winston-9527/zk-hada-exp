/- T7c R1b driver: reads op lines on stdin, runs `exec`, prints the abstract state after each op.
   lines: "delta D" | "reset" | "mint q c1 c2 ..." | "split i q1 q2" | "delegate i c q1 q2" | "execute i qs qc" | "revoke c" | "tick"
   output per op: "ok|rej size=N minted=M used=U now=T spent=0101 revoked=c@t,..." (revoked entries listed for ids 0..63) -/
import Refine
open BudgetSM

def parseOp (ws : List String) : Option Op :=
  let n := fun (x : String) => x.toNat!
  match ws with
  | "mint" :: q :: rest => some (.mint (n q) (rest.map n))
  | ["split", i, a, b] => some (.split (n i) (n a) (n b))
  | ["delegate", i, c, a, b] => some (.delegate (n i) (n c) (n a) (n b))
  | ["execute", i, a, b] => some (.execute (n i) (n a) (n b))
  | ["revoke", c] => some (.revoke (n c))
  | ["tick"] => some .tick
  | _ => none

def fmt (ok : Bool) (s : St) : String :=
  let spent := String.join ((List.range s.size).map (fun j => if s.spent j then "1" else "0"))
  let rev := (List.range 64).filterMap (fun c => (s.revokedAt c).map (fun t => s!"{c}@{t}"))
  s!"{if ok then "ok" else "rej"} size={s.size} minted={s.minted} used={s.used} now={s.now} spent={spent} revoked={",".intercalate rev}"

partial def loop (Δ : ℕ) (s : St) (stdin : IO.FS.Stream) (stdout : IO.FS.Stream) : IO Unit := do
  let line ← stdin.getLine
  if line.isEmpty then return
  let ws := (line.trim.splitOn " ").filter (· ≠ "")
  match ws with
  | ["delta", d] => loop d.toNat! s stdin stdout
  | ["reset"] => stdout.putStrLn "reset"; stdout.flush; loop Δ init stdin stdout
  | [] => loop Δ s stdin stdout
  | _ =>
    match parseOp ws with
    | none => stdout.putStrLn s!"parse-error {line.trim}"; stdout.flush; loop Δ s stdin stdout
    | some op =>
      match exec Δ s op with
      | some s' => stdout.putStrLn (fmt true s'); stdout.flush; loop Δ s' stdin stdout
      | none => stdout.putStrLn (fmt false s); stdout.flush; loop Δ s stdin stdout

def main : IO Unit := do
  loop 0 init (← IO.getStdin) (← IO.getStdout)
