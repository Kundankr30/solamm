#!/bin/bash
WALLET="9uwiuhszEDw3Bmn7NJTmNt8PzjnR18twGFMbtn671Pzw"
AMOUNT=10000

MINTS=(
  "3viDYdV3ks8tSrGyfURhrsUzVMPbvjbn5nWUhN4nZSYk"
  "FnCU6np8uKE8KZkrMACXMfj1mr1JFhiKqfVF97JVkV8t"
  "2A5Hymij33vXewSC6VmjnZPFyYoH9DSu7tVXKKivDLEs"
  "HGuEDHNb66UpxnGYjMYPtkdprjsUuvhN8RghxZsK2BiW"
)

for MINT in "${MINTS[@]}"; do
  echo "Setting up ATA for $MINT..."
  OUTPUT=$(spl-token create-account $MINT --owner $WALLET --url devnet 2>&1)
  echo "$OUTPUT"
  
  # Try to extract the account address. It might already exist.
  if [[ "$OUTPUT" == *"already exists"* ]]; then
     ATA=$(echo "$OUTPUT" | grep -oE '[1-9A-HJ-NP-Za-km-z]{32,44}')
  else
     # The output usually says "Creating account <ATA>"
     ATA=$(echo "$OUTPUT" | grep "Creating account" | awk '{print $3}')
  fi
  
  # If we couldn't parse the ATA, spl-token accounts might help or we can just try passing the wallet directly?
  # Wait, spl-token mint <MINT> <AMOUNT> <ATA>
  
  # Actually, the simplest way is to use spl-token mint with the ATA we got, but we might not have parsed it right.
  # Let's just do spl-token mint <MINT> <AMOUNT> <ATA>
  echo "ATA is $ATA"
  
  echo "Minting to $ATA..."
  spl-token mint $MINT $AMOUNT $ATA --url devnet
  echo "----------------"
done
