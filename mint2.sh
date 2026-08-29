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
  echo "Getting ATA for $MINT..."
  OUTPUT=$(spl-token create-account $MINT --owner $WALLET --fee-payer ~/.config/solana/id.json --url devnet 2>&1)
  
  if [[ "$OUTPUT" == *"already exists"* ]]; then
     ATA=$(echo "$OUTPUT" | grep -oE '[1-9A-HJ-NP-Za-km-z]{32,44}' | head -1)
  else
     ATA=$(echo "$OUTPUT" | grep "Creating account" | awk '{print $3}')
  fi
  
  echo "Minting to $ATA..."
  spl-token mint $MINT $AMOUNT $ATA --url devnet
  echo "----------------"
done
