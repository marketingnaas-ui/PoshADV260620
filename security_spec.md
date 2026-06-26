# Security Specification for ClearAdvance

## Data Invariants
1. Global state must always contain advances, settings, and running_numbers.
2. Master data stores must always have a records array.
3. Timestamps should be managed by the server where possible.

## The "Dirty Dozen" Payloads (Attack Vectors)
1. **Schema Injection**: Attempting to write a store document without the 'records' field.
2. **Resource Exhaustion**: Writing a 10MB records array.
3. **ID Poisoning**: Using a 1KB string as storeId.
4. **State Corruption**: Deleting the 'settings' from the global state.
5. **Type Confusion**: Writing a string where a list (records) is expected.
6. **Path Traversal**: Attempting to write to a document outside the allowed collections.
7. **Malicious Metadata**: Injecting hidden fields into the store document.
8. **Running Number Reset**: Attempting to overwrite running_numbers with zeros.
9. **Advance Hijacking**: (If multi-user rules were implemented) Modifying an advance not owned by the user.
10. **Admin Escalation**: (If roles were in Firestore) Setting isAdmin to true on a user profile.
11. **Log Tampering**: Modifying or deleting audit logs.
12. **OCR Data Poisoning**: Injecting malicious script into OCR scan results.

## The Test Runner
(A separate firestore.rules.test.ts would be needed, but since I cannot run it easily without emulators, I will ensure the rules cover these cases.)
