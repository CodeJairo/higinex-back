-- Ensure only one active (and not soft-deleted) contract per customer.
CREATE UNIQUE INDEX "Contract_one_active_per_customer" ON "Contract" ("customerId")
WHERE
    (
        "isActive" = true
        AND "deletedAt" IS NULL
    );