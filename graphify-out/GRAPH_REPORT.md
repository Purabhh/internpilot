# Graph Report - .  (2026-10-22)

## Corpus Check
- 103 files · ~54,683 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 299 nodes · 413 edges · 60 communities detected
- Extraction: 70% EXTRACTED · 30% INFERRED · 0% AMBIGUOUS · INFERRED: 124 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]

## God Nodes (most connected - your core abstractions)
1. `GET()` - 45 edges
2. `PATCH()` - 28 edges
3. `POST()` - 14 edges
4. `processEmails()` - 13 edges
5. `getSettings()` - 10 edges
6. `DELETE()` - 8 edges
7. `dataDir()` - 8 edges
8. `openDb()` - 8 edges
9. `tickTracker()` - 8 edges
10. `dbPath()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `listApplications()`  [INFERRED]
  app\api\sources\route.ts → lib\db\queries\applications.ts
- `GET()` --calls--> `getAuthUrl()`  [INFERRED]
  app\api\sources\route.ts → lib\tracker\gmail-client.ts
- `GET()` --calls--> `listResumes()`  [INFERRED]
  app\api\sources\route.ts → lib\db\queries\resumes.ts
- `GET()` --calls--> `countJobsToEnrich()`  [INFERRED]
  app\api\sources\route.ts → lib\db\queries\jobs.ts
- `POST()` --calls--> `saveResumeFile()`  [INFERRED]
  app\api\sources\refresh\route.ts → lib\db\queries\resumes-fs.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (15): correctEmail(), countEmails(), getEmail(), insertEmailIfNew(), listEmails(), seed(), createManualJob(), job() (+7 more)

### Community 1 - "Community 1"
Cohesion: 0.13
Nodes (16): createApplicationFromJob(), deleteApplication(), getApplication(), getApplicationByJobId(), listApplications(), updateApplication(), deleteResume(), deleteResumeFile() (+8 more)

### Community 2 - "Community 2"
Cohesion: 0.17
Nodes (15): createApplication(), classifyByLlm(), classifyByRules(), companyFromSender(), detectCompany(), extractCompany(), matchesKeywordGroups(), trimStopWords() (+7 more)

### Community 3 - "Community 3"
Cohesion: 0.16
Nodes (13): tickEnrich(), fetchNewMessages(), isStaleHistoryError(), parseReceivedAt(), heartbeat(), runEnrichNow(), runScraperNow(), runTrackerNow() (+5 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (6): atsFromUrl(), formatAnnual(), formatSalaryRange(), relativeTime(), ApplicationCard(), MasterToggle()

### Community 5 - "Community 5"
Cohesion: 0.23
Nodes (14): runEnricher(), buildJobConditions(), countJobs(), countJobsToEnrich(), dismissJob(), getJob(), listJobs(), listJobsToEnrich() (+6 more)

### Community 6 - "Community 6"
Cohesion: 0.24
Nodes (12): exchangeCode(), getAuthUrl(), loadOAuthClient(), readToken(), writeToken(), register(), credentialsPath(), dataDir() (+4 more)

### Community 7 - "Community 7"
Cohesion: 0.21
Nodes (8): cleanRole(), extractTerms(), jobrightId(), JobrightScraper, normalizeJobrightRows(), parseLink(), parsePostedAt(), parseMarkdownTable()

### Community 8 - "Community 8"
Cohesion: 0.26
Nodes (8): jobType(), parseTermsJson(), passesJsFilters(), companyCategory(), isExcludedRole(), matchNiche(), normalizeCompany(), pickResume()

### Community 9 - "Community 9"
Cohesion: 0.23
Nodes (8): createDb(), migrateApplicationsStatusCheck(), openDb(), seedSettings(), seedSources(), seed(), seed(), freshDb()

### Community 10 - "Community 10"
Cohesion: 0.2
Nodes (0): 

### Community 11 - "Community 11"
Cohesion: 0.42
Nodes (8): fetchSalary(), annualize(), detectUnit(), matchRange(), matchSingle(), parseAmount(), parseSalary(), plausibleAnnual()

### Community 12 - "Community 12"
Cohesion: 0.2
Nodes (2): SimplifyNewGradScraper, SimplifyOffSeasonScraper

### Community 13 - "Community 13"
Cohesion: 0.29
Nodes (4): buildDefaultScrapers(), runScrapers(), upsertJobs(), FakeScraper

### Community 14 - "Community 14"
Cohesion: 0.33
Nodes (1): VanshOffSeasonScraper

### Community 15 - "Community 15"
Cohesion: 0.5
Nodes (2): Shell(), useNavCounts()

### Community 16 - "Community 16"
Cohesion: 0.7
Nodes (4): deleteJson(), fetchJson(), patchJson(), postJson()

### Community 17 - "Community 17"
Cohesion: 0.5
Nodes (1): SpeedySweScraper

### Community 18 - "Community 18"
Cohesion: 1.0
Nodes (2): New-IconPng(), New-RoundRect()

### Community 19 - "Community 19"
Cohesion: 0.67
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 0.67
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Community 22"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Community 23"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Community 50"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Community 51"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Community 52"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Community 53"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Community 54"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Community 55"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Community 56"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Community 57"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Community 58"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Community 59"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 21`** (2 nodes): `New-IpShortcut()`, `install-desktop-shortcut.ps1`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (2 nodes): `page.tsx`, `Page()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (2 nodes): `page.tsx`, `relativeTime()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (2 nodes): `Providers.tsx`, `Providers()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (2 nodes): `fetchJson()`, `base.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (2 nodes): `fakeFetch()`, `runner.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (2 nodes): `fakeAnthropic()`, `mock-anthropic.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (2 nodes): `fakeFetch()`, `github-simplify.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (2 nodes): `fakeFetch()`, `github-vansh.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (2 nodes): `load()`, `classifier-rules.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `tailwind.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `vitest.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (1 nodes): `layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `schema.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (1 nodes): `boot.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (1 nodes): `paths.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (1 nodes): `smoke.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (1 nodes): `applications.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (1 nodes): `jobs.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (1 nodes): `overview.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (1 nodes): `resumes-fs.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (1 nodes): `resumes-queries.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (1 nodes): `settings.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (1 nodes): `sources.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (1 nodes): `client.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (1 nodes): `schema.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (1 nodes): `salary-parse.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (1 nodes): `scheduler.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (1 nodes): `base.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (1 nodes): `github-speedy.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (1 nodes): `jobright.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (1 nodes): `classifier-llm.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (1 nodes): `gmail-client.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (1 nodes): `matcher.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (1 nodes): `pipeline.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (1 nodes): `resolve-application.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GET()` connect `Community 0` to `Community 1`, `Community 2`, `Community 3`, `Community 5`, `Community 6`, `Community 8`, `Community 9`, `Community 13`?**
  _High betweenness centrality (0.153) - this node is a cross-community bridge._
- **Why does `PATCH()` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`, `Community 5`, `Community 6`, `Community 9`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `processEmails()` connect `Community 2` to `Community 0`, `Community 1`, `Community 3`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Are the 32 inferred relationships involving `GET()` (e.g. with `openDb()` and `dbPath()`) actually correct?**
  _`GET()` has 32 INFERRED edges - model-reasoned connections that need verification._
- **Are the 22 inferred relationships involving `PATCH()` (e.g. with `openDb()` and `dbPath()`) actually correct?**
  _`PATCH()` has 22 INFERRED edges - model-reasoned connections that need verification._
- **Are the 9 inferred relationships involving `POST()` (e.g. with `openDb()` and `dbPath()`) actually correct?**
  _`POST()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `processEmails()` (e.g. with `tickTracker()` and `classifyByRules()`) actually correct?**
  _`processEmails()` has 12 INFERRED edges - model-reasoned connections that need verification._