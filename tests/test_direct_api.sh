#!/bin/bash

echo "=== Direct API Test ==="
echo ""
echo "1. Testing /api/v3/kuramanime/home"
curl -s http://localhost:5000/api/v3/kuramanime/home | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    print(f'✓ Status: {d.get(\"status\")}')
    data = d.get('data', {})
    for key in data:
        print(f'  - {key}: {len(data[key])} items')
except Exception as e:
    print(f'✗ Error: {e}')
"

echo ""
echo "2. Testing from browser perspective"
curl -s -H "Accept: application/json" http://localhost:5000/api/v3/kuramanime/home | head -100

echo ""
echo "3. Checking response headers"
curl -sI http://localhost:5000/api/v3/kuramanime/home

echo ""
echo "=== Test Complete ==="
