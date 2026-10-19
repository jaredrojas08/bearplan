# Writing a requirement template

A template is one JSON file that describes a major's checklist. BearPlan reads it and builds the requirements grid, the drop rules, the progress numbers and the "What's left" list from it. No code changes are needed to add a major.

The CS template in [`src/templates/cs-engineering-fa24.json`](../src/templates/cs-engineering-fa24.json) uses every feature below, so it is the best example to copy.

## Two ways to add one

- **Just for you:** in the app, open Plan settings (gear icon) and choose **Import requirement template**, or use **Import a checklist JSON…** during setup. It is saved in your browser.
- **For everyone:** add the file to `src/templates/`, add it to `BUILT_IN_TEMPLATES` in `src/lib/store.svelte.ts`, and open a pull request. Link the official checklist or handbook page in the PR.

## Top level

```json
{
  "id": "info-cals-fa25",
  "name": "Information Science",
  "college": "CALS",
  "matriculatedFrom": "FA25",
  "totalCredits": 120,
  "totalCreditsNote": "120 cr minimum. Confirm with your advisor.",
  "filters": [{ "id": "college", "label": "College", "icon": "book" }],
  "repeatableCodes": ["INFO 4900"],
  "failingGrades": ["S", "SX", "U", "UX", "D+", "D", "D-", "F"],
  "sections": [],
  "checks": []
}
```

| Field | Meaning |
|---|---|
| `id` | Unique, no spaces. Saved plans point at it, so don't change it once people use it. |
| `matriculatedFrom` | First entry term the checklist applies to, like `FA24`. |
| `totalCredits` | Optional. Shown as "88 / 120 cr". Leave it out if you don't know it. |
| `filters` | The filter pills above the grid. Each section names one with its `filter` field. |
| `repeatableCodes` | Courses allowed more than once (research, independent study, team projects). Everything else is "no course may be used twice". Students can also mark any course repeatable from the placing banner; that list is saved in their plan, not the template. |
| `failingGrades` | Grades that get a warning in sections marked `letterGrade`. |

## Sections

```json
{
  "id": "core",
  "title": "CS Core",
  "column": "right",
  "filter": "core",
  "icon": "code",
  "note": "Shown under the title.",
  "leftLabel": "Core",
  "type": "slots",
  "letterGrade": true,
  "slots": [{ "id": "c1", "label": "CS 2800 / 2802", "rule": [{ "codes": ["CS 2800", "CS 2802"] }] }]
}
```

- `type: "slots"`: fixed rows, one course each, with a `slots` list.
- `type: "creditBucket"`: any number of courses until `minCredits` is reached. The `rule` on the section applies to every course in it.
- `column` is `left` or `right` for the "All" view.
- `icon` is one of `pen`, `book`, `flask`, `sigma`, `code`, `star`, `run`, `plus`.
- `leftLabel` is the short name in "What's left". It defaults to the title.
- `letterGrade: true` flags S/U and failing grades in the section.
- `swimTest: true` adds the swim test checkbox, and `spcl: true` adds the area-name field.
- `excludeFromCredits: true` keeps the section's credits out of the degree total (PE).

## Rules

A `rule` is a list of matches. A course fits if it satisfies **any** match, and a match passes only if **all** its fields hold.

| Field | Example | Passes when |
|---|---|---|
| `codes` | `["MATH 1910"]` | The code is in the list. |
| `subjects` | `["ENGRD"]` | The subject is in the list. |
| `excludeSubjects` | `["CS"]` | The subject is not in the list. |
| `excludeCodes` | `["CS 4090"]` | The code is not in the list. |
| `minLevel` / `maxLevel` | `3000` | The catalog number is at least / at most this. |
| `minCredits` | `3` | The course has at least this many credits. |
| `numberPattern` | `["4xx1"]` | The number fits a pattern, where `x` is any digit. |
| `excludeNumberPattern` | `["10xx"]` | The number fits none of the patterns. |
| `distributions` | `["CA", "SCD-HA"]` | The course has one of these distribution categories. `CA` matches `CA-AG` and `CA-AS`; a category with a dash matches only itself. |
| `reason` | `"Not a writing seminar"` | Replaces the generated refusal message. |

Two examples from the CS template:

```json
"rule": [
  { "subjects": ["CS"], "minLevel": 4000, "minCredits": 3, "excludeCodes": ["CS 4090"] },
  { "codes": ["CS 3700", "CS 3780"] }
]
```

A CS elective is either non-excluded CS 4000+ with 3+ credits, or CS 3700/3780.

```json
"rule": [
  { "excludeSubjects": ["PE", "AIRS", "MILS", "NAVS"], "excludeNumberPattern": ["10xx"] },
  { "subjects": ["AIRS", "MILS", "NAVS"], "minLevel": 3000 }
]
```

Anything except PE, 10xx courses and ROTC, plus ROTC at 3000 and above.

## Section constraints

Constraints check a whole section. They show as chips under the title, and unmet ones appear in "What's left".

| Type | Fields | Example |
|---|---|---|
| `minCredits` | `credits` | Liberal Studies needs 18 credits. |
| `minCount` | `count`, `match` | At least 2 courses with `{ "minLevel": 2000 }`. |
| `maxCount` | `count`, `match`, `reason` | At most one 2000-level technical elective. Drops that would break it are refused with `reason`. |
| `minGroups` | `count` | Courses from at least 3 groups. |
| `groupMinCredits` | `group`, `credits` | One course of at least 3 credits in Group 7. |
| `groupMaxCount` | `group`, `count` | At most 2 courses from Group 6. |

Group constraints need a `groups` list on the section. Each group has an `id`, a `name`, and `categories` and/or `codes`. A course that fits several groups is assigned to one automatically, picking the assignment that meets the most constraints.

## Plan-wide checks

Checks are requirements that are not rows. They pass when any course in the plan, in any section, is in `codes`.

```json
{
  "id": "probability",
  "title": "Probability",
  "codes": ["BTRY 3080", "ECON 3130"],
  "metText": "satisfied by {code}",
  "missText": "not yet. Needs an accepted probability course."
}
```

## Distribution categories

Course categories come from the Class Roster API (`crseAttrs` entries marked `DistReq`), e.g. `SBA-AG`, `ALC-AS`, `SCD-AS`. Search a course in the app and drag it onto a distribution row to see what it carries; a refused drop lists the course's categories.

## Checking your file

Import it in the app. If the shape is wrong, the import lists each problem, like `sections[2].column must be "left" or "right"`. Once it loads, try dropping a few courses that should and should not fit.
