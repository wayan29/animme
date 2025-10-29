#!/bin/bash

echo "Testing Kuramanime Detail API Endpoint"
echo "======================================="
echo ""

# Test 1: Detail anime dengan anime_lainnya
echo "Test 1: GET /api/v3/kuramanime/anime/4081/ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga"
echo ""
curl -s "http://localhost:3001/api/v3/kuramanime/anime/4081/ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga" | python3 -m json.tool | head -100

echo ""
echo ""
echo "Checking anime_lainnya field..."
curl -s "http://localhost:3001/api/v3/kuramanime/anime/4081/ansatsusha-de-aru-ore-no-status-ga-yuusha-yori-mo-akiraka-ni-tsuyoi-no-da-ga" | python3 -c "import json, sys; data = json.load(sys.stdin); print(f'anime_lainnya count: {len(data[\"data\"][\"anime_lainnya\"])}'); [print(f'{i+1}. {item[\"title\"]} - Poster: {\"✓\" if item[\"poster\"] else \"✗\"}') for i, item in enumerate(data['data']['anime_lainnya'])]"

echo ""
echo ""
echo "✓ Test completed!"
