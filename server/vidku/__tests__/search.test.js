const { test } = require('node:test')
const assert = require('node:assert')

const {
    buildKeywordQuery,
    matchesKeyword
} = require('../helpers')
const { scrapeSearch, scrapeAdvancedSearch } = require('../search')

// Build a raw Vidku /anime API item. mapApiAnimeItem reads title/slug/thumbnail.
const raw = (title, slug) => ({ title, slug, thumbnail: `https://img.test/${slug}.jpg` })

// Fake fetcher that serves `pages` (array of arrays of raw items) with sane
// pagination metadata so collectAnimeMatches can walk across pages.
function pagedFetcher(pages) {
    return async (path, params) => {
        assert.ok(['/anime', '/anime/search'].includes(path), 'fetcher should target a Vidku anime endpoint')
        const pageIdx = Math.max(0, (Number(params?.page) || 1) - 1)
        const data = pages[pageIdx] || []
        return {
            data,
            meta: {
                current_page: pageIdx + 1,
                has_next_page: pageIdx + 1 < pages.length,
                next_page: pageIdx + 2 <= pages.length ? pageIdx + 2 : null,
                last_page: pages.length,
                total_pages: pages.length,
                total_items: pages.reduce((n, p) => n + p.length, 0)
            }
        }
    }
}

// --- Pure helper tests (no network, no mocks) ---

test('buildKeywordQuery normalises and returns null for empty input', () => {
    const kq = buildKeywordQuery('  Naruto  ')
    assert.strictEqual(kq.text, 'naruto')
    assert.strictEqual(kq.slug, 'naruto')
    assert.deepStrictEqual(kq.tokens, ['naruto'])

    assert.strictEqual(buildKeywordQuery(''), null)
    assert.strictEqual(buildKeywordQuery('   '), null)
    assert.strictEqual(buildKeywordQuery(null), null)
    assert.strictEqual(buildKeywordQuery(undefined), null)
})

test('buildKeywordQuery tokenises multi-word queries', () => {
    const kq = buildKeywordQuery('Naruto Shippuden')
    assert.strictEqual(kq.text, 'naruto shippuden')
    assert.strictEqual(kq.slug, 'naruto-shippuden')
    assert.deepStrictEqual(kq.tokens, ['naruto', 'shippuden'])
})

test('matchesKeyword: substring match on title or slug', () => {
    const kq = buildKeywordQuery('naruto')
    assert.strictEqual(matchesKeyword({ title: 'Naruto Shippuden', slug: 'naruto-shippuden' }, kq), true)
    assert.strictEqual(matchesKeyword({ title: 'One Piece', slug: 'one-piece' }, kq), false)
    // slug-only match
    assert.strictEqual(matchesKeyword({ title: 'Special', slug: 'naruto-the-movie' }, kq), true)
    // case-insensitive
    assert.strictEqual(matchesKeyword({ title: 'NARUTO', slug: 'x' }, kq), true)
})

test('matchesKeyword: token match when whole phrase is not a substring', () => {
    const kq = buildKeywordQuery('naruto shippuden')
    // reordered title: not a substring of the phrase, but both tokens present
    assert.strictEqual(matchesKeyword({ title: 'Shippuden Naruto', slug: 'x' }, kq), true)
    // missing one token
    assert.strictEqual(matchesKeyword({ title: 'Naruto Movie', slug: 'nm' }, kq), false)
})

test('matchesKeyword: null query matches everything', () => {
    assert.strictEqual(matchesKeyword({ title: 'Anything', slug: 'a' }, null), true)
    assert.strictEqual(matchesKeyword({}, null), true)
})

// --- Orchestration tests (inject a fake fetcher) ---

test('search returns ONLY matches on page 1 (does not leak unrelated items)', async () => {
    const fetcher = pagedFetcher([
        [raw('Naruto', 'naruto'), raw('Bleach', 'bleach'), raw('One Piece', 'one-piece')]
    ])
    const res = await scrapeSearch('naruto', { fetcher })

    assert.strictEqual(res.status, 'success')
    assert.ok(Array.isArray(res.data))
    assert.strictEqual(res.data.length, 1, 'only the matching item should be returned')
    assert.strictEqual(res.data[0].slug, 'naruto')
})

test('CORE BUG FIX: search returns [] (not all) when keyword matches nothing', async () => {
    const fetcher = pagedFetcher([
        [raw('Bleach', 'bleach'), raw('One Piece', 'one-piece'), raw('DBZ', 'dbz')]
    ])
    const res = await scrapeSearch('naruto', { fetcher })

    assert.strictEqual(res.status, 'success')
    assert.deepStrictEqual(res.data, [], 'must NOT fall back to returning all anime')
})

test('search walks multiple pages to find matches (single-page recall bug)', async () => {
    const fetcher = pagedFetcher([
        [raw('Bleach', 'bleach')],
        [raw('One Piece', 'one-piece')],
        [raw('Naruto', 'naruto')]
    ])
    const res = await scrapeSearch('naruto', { fetcher })

    assert.strictEqual(res.data.length, 1)
    assert.strictEqual(res.data[0].slug, 'naruto')
})

test('search dedupes the same slug across pages', async () => {
    const fetcher = pagedFetcher([
        [raw('Naruto', 'naruto')],
        [raw('Naruto', 'naruto')]
    ])
    const res = await scrapeSearch('naruto', { fetcher })

    assert.strictEqual(res.data.length, 1)
})

test('search respects the maxPages cap (match beyond the cap is not found)', async () => {
    const pages = Array.from({ length: 12 }, (_, i) => [raw(`Filler ${i + 1}`, `filler-${i + 1}`)])
    pages[11] = [raw('Naruto', 'naruto')] // only on page 12
    const fetcher = pagedFetcher(pages)

    const res = await scrapeSearch('naruto', { fetcher, maxPages: 10 })
    assert.deepStrictEqual(res.data, [], 'should not reach page 12 within maxPages=10')
})

test('empty keyword returns a single unfiltered page and does not paginate', async () => {
    let calls = 0
    const inner = pagedFetcher([[raw('A', 'a')], [raw('B', 'b')], [raw('C', 'c')]])
    const fetcher = async (path, params) => {
        calls += 1
        return inner(path, params)
    }

    const res = await scrapeSearch('', { fetcher })
    assert.strictEqual(calls, 1, 'should fetch exactly one page for an empty keyword')
    assert.strictEqual(res.data.length, 1)
    assert.strictEqual(res.data[0].slug, 'a')
})

test('search result shape is preserved', async () => {
    const fetcher = pagedFetcher([[raw('Naruto', 'naruto')]])
    const res = await scrapeSearch('naruto', { fetcher })

    assert.strictEqual(res.status, 'success')
    for (const item of res.data) {
        assert.ok(item.slug, 'each item has a slug')
        assert.ok(item.title, 'each item has a title')
        assert.ok(Array.isArray(item.genres), 'each item has genres[]')
        assert.strictEqual(typeof item.poster, 'string')
    }
})

// --- Advanced search shape + filtering ---

test('advanced search filters by keyword and preserves its response shape', async () => {
    const fetcher = pagedFetcher([[raw('Naruto', 'naruto'), raw('Bleach', 'bleach')]])
    const res = await scrapeAdvancedSearch({ title: 'naruto' }, 1, { fetcher })

    assert.strictEqual(res.status, 'success')
    assert.strictEqual(res.data.animeData.length, 1)
    assert.strictEqual(res.data.animeData[0].slug, 'naruto')
    assert.strictEqual(res.data.total_results, 1)
    assert.ok(res.data.pagination, 'pagination present')
    assert.strictEqual(res.data.applied_filters.title, 'naruto')
})

test('advanced search returns empty (not all) when keyword matches nothing', async () => {
    const fetcher = pagedFetcher([[raw('Bleach', 'bleach'), raw('One Piece', 'one-piece')]])
    const res = await scrapeAdvancedSearch({ title: 'naruto' }, 1, { fetcher })

    assert.strictEqual(res.data.animeData.length, 0)
    assert.strictEqual(res.data.total_results, 0)
})
