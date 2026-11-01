# Audit 5 notes (ops)
- Start (Nov 1 16:44 UTC): main f676ad1245900229d1a3f58ebaa6815d7a610d59 (index 8b0c08c6, test-wallet 6bf01c65 = audit-4 staging, deployed bytes equal, embedded "candidate 24cda89"); origin/audit-wallet-4 38264fccc302c9bcdbdcf17ec6aaaca7edbc0a1b (index 703602f1; tree identical to the local audit-4 staging branch; local 24cda89 unpublished). Deployed homepage sha256 8b0c08c6 = main.
- Registry at 38264fc: 161 ids (wallet 38, audit2 35, audit3 21, audit3b 17, audit4 29, audit4review 12, audit4scan 7, harness 2), no duplicates.
- FRESH BASELINE on 38264fc (run concurrently with three agents' runs = loaded machine): 159/161, FAILED hz2 and a4s3 (ev/baseline-38264fc.log).
  - hz2: probesWhileOpen 0 -> the probe timer never fired before the context was closed: timing assumption under load (passed in the harness agent's own baseline run on e7149ea). Assigned to H5: gate it.
  - a4s3: behaviour assertions true, but failedOnPageErrors "Uncaught (in promise) Error: server response 500 ... publicnode": an unhandled rejection in the page when all readers fail. Real page defect (load-dependent). Assigned to P5 (a5x).
