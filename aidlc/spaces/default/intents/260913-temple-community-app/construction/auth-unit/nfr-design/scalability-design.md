# Scalability Design — auth-unit

## Design for NFR-SC.1 (capacity growth to ~1000 identities/12mo)

No scaling architecture is designed here — a Cognito User Pool is a fully managed AWS service that scales its identity-storage and token-issuance capacity transparently, with no capacity planning, sharding, or provisioning action available (or needed) from this project. At the ~1000-identity, intermittent-usage ceiling this project projects, Cognito's own service limits (tens of thousands of requests/second by default) are never approached by orders of magnitude.

No horizontal/vertical scaling decision, load balancer, or data partitioning strategy applies — there is no compute or data tier this Unit owns to scale.
