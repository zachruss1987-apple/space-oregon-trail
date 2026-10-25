# Kanban

Source of truth: `kanban/tasks.json`. View: `kanban/index.html` (generated; open the file directly or visit `/kanban/` on the Pages site). The page auto-refreshes every 30 s, so leave it open while agents work.

## Commands
```
npm run kanban -- add --title "Daily travel tick" --milestone M1 --role developer --status todo --desc "..."
npm run kanban -- move T-012 doing --by developer
npm run kanban -- note T-012 "tick() implemented; 23 unit tests"
npm run kanban -- list --milestone M1 --status doing
npm run kanban -- milestone M1 active        # planned | active | done
npm run kanban -- build                      # regenerate index.html only
npm run kanban:open                          # build and open in the default browser
npm run kanban -- sync                       # mirror to GitHub Issues (PM only)
```
Statuses: `backlog`, `todo`, `doing`, `review`, `done`, `blocked`. Roles: `program-manager`, `developer`, `tester`, `designer`, `writer`, `graphics`, `sound`.

## GitHub Issues mirror
`sync` creates an issue for every non-backlog card lacking one (labels `role:*`, `milestone:*`) and closes issues for `done` cards with the last note as the closing comment. The card stores the issue number, so the board links to it.

## Conventions
- Card titles are imperative and specific. Descriptions carry acceptance criteria, not implementation.
- Every status change should come with a note when it carries information (what was done, why blocked).
- Bugs are cards titled `Bug: ...` assigned to `developer` with a seed and repro in the description.
