<template>
  <section class="search-page">
    <UCard class="search-panel" variant="outline">
      <SearchToolbar
        :query="query"
        :field="field"
        :loading="loading"
        @update:query="query = $event"
        @update:field="field = $event"
        @search="onSearch"
      />

      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="hasSearched && !loading" class="meta">找到 {{ total }} 条结果</p>
    </UCard>

    <section class="results" v-if="results.length > 0">
      <SearchResults :items="results" />
      <SearchPagination
        v-if="total > pageSize"
        :page="page"
        :page-size="pageSize"
        :total="total"
        @update:page="onPageChange"
      />
    </section>

    <section class="empty" v-else-if="hasSearched && !loading">
      Nothing found.
    </section>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SearchResults from '@/components/search/SearchResults.vue'
import SearchToolbar from '@/components/search/SearchToolbar.vue'
import SearchPagination from '@/components/search/SearchPagination.vue'
import type { SearchField, SearchItem, SearchResponse } from '@/utils/search'

const route = useRoute()
const router = useRouter()

const query = ref('')
const field = ref<SearchField>('content')
const page = ref(1)
const pageSize = 20
const loading = ref(false)
const error = ref('')
const hasSearched = ref(false)
const total = ref(0)
const results = ref<SearchItem[]>([])

function normalizeQueryState() {
  const nextQuery = String(route.query.q ?? '').trim()
  const nextField = String(route.query.field ?? 'content') === 'title' ? 'title' : 'content'
  const rawPage = Number.parseInt(String(route.query.page ?? '1'), 10)
  const nextPage = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage

  return {
    query: nextQuery,
    field: nextField as SearchField,
    page: nextPage
  }
}

async function updateUrlState(nextPage = 1) {
  const q = query.value.trim()
  const targetQuery = q
    ? {
        q,
        field: field.value,
        page: String(nextPage),
        pageSize: String(pageSize)
      }
    : {}

  await router.replace({ query: targetQuery })
}

async function fetchSearch() {
  if (!query.value.trim()) {
    results.value = []
    total.value = 0
    hasSearched.value = false
    return
  }

  loading.value = true
  error.value = ''

  try {
    const params = new URLSearchParams({
      q: query.value,
      field: field.value,
      page: String(page.value),
      pageSize: String(pageSize)
    })

    const response = await fetch(`./api/search?${params.toString()}`)
    if (!response.ok) {
      throw new Error(`搜索失败 (${response.status})`)
    }

    const payload = (await response.json()) as SearchResponse
    total.value = payload.total
    results.value = payload.results
    hasSearched.value = true
  } catch (err) {
    error.value = err instanceof Error ? err.message : '搜索失败'
    results.value = []
    total.value = 0
    hasSearched.value = true
  } finally {
    loading.value = false
  }
}

async function onSearch() {
  page.value = 1
  await updateUrlState(1)
}

async function onPageChange(nextPage: number) {
  page.value = nextPage
  await updateUrlState(nextPage)
}

watch(
  () => route.query,
  async () => {
    const state = normalizeQueryState()
    query.value = state.query
    field.value = state.field
    page.value = state.page
    await fetchSearch()
  },
  { immediate: true }
)
</script>

<style scoped>
.search-page {
  width: min(980px, 100%);
  margin: 0 auto;
}

.search-panel,
.results,
.empty {
  width: 100%;
}

.search-panel {
  margin-bottom: 1rem;
}

.meta {
  margin-top: 0.75rem;
  font-size: 0.92rem;
  color: var(--ns-muted);
}

.error {
  margin-top: 0.75rem;
  color: var(--ns-danger);
}

.empty {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 0.9rem;
  border: 1px dashed var(--ns-border);
  color: var(--ns-muted);
  background: var(--ns-surface-soft);
}

:deep(mark) {
  padding: 0 0.15em;
  border-radius: 0.2em;
  background: var(--ns-mark-bg);
  color: var(--ns-mark-text);
}
</style>
