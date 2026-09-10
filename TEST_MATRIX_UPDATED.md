| ID     | Test                         | Expected Result                       | Actual Result | Status |
| ------ | ---------------------------- | ------------------------------------- | ------------- | ------ |
| D9-01  | Set rollout to 0%            | All users OFF                         | Passed        | ✅     |
| D9-02  | Set rollout to 100%          | All users ON                          | Passed        | ✅     |
| D9-03  | Set rollout to 50%           | Users deterministically split         | Passed        | ✅     |
| D9-04  | Evaluate same user 5 times   | Same result every time                | Passed        | ✅     |
| D9-05  | Restart backend              | Same user gets same result            | Passed        | ✅     |
| D9-06  | Enter -1%                    | Validation error                      | Passed        | ✅     |
| D9-07  | Enter 101%                   | Validation error                      | Passed        | ✅     |
| D9-08  | Refresh Flag Detail          | Saved percentage remains              | Passed        | ✅     |
| D9-09  | Change percentage            | Backend/database updated              | Passed        | ✅     |
| D9-10  | Different flag key           | Different hash context                | Passed        | ✅     |
| D10-01 | List environments            | Dev/Staging/Production displayed      | Passed        | ✅     |
| D10-02 | Create environment           | Environment created                   | Passed        | ✅     |
| D10-03 | Duplicate environment        | Request rejected                      | Passed        | ✅     |
| D10-04 | Edit environment             | Changes persisted                     | Passed        | ✅     |
| D10-05 | Delete environment           | Environment removed/blocked correctly | Passed        | ✅     |
| D10-06 | Configure flag in Dev        | Dev value saved                       | Passed        | ✅     |
| D10-07 | Configure flag in Staging    | Staging value saved                   | Passed        | ✅     |
| D10-08 | Configure flag in Production | Production value saved                | Passed        | ✅     |
| D10-09 | Change Production            | Staging/Dev unchanged                 | Passed        | ✅     |
| D10-10 | Refresh environment page     | Data remains correct                  | Passed        | ✅     |
| D11-01 | Evaluate default flag        | Default returned                      | Passed        | ✅     |
| D11-02 | Environment override         | Override returned                     | Passed        | ✅     |
| D11-03 | Percentage evaluation        | Rollout result returned               | Passed        | ✅     |
| D11-04 | Group targeting              | Group result returned                 | Passed        | ✅     |
| D11-05 | User targeting               | User result returned                  | Passed        | ✅     |
| D11-06 | User vs Group conflict       | User wins                             | Passed        | ✅     |
| D11-07 | Group vs Percentage conflict | Group wins                            | Passed        | ✅     |
| D11-08 | Percentage vs Environment    | Percentage wins                       | Passed        | ✅     |
| D11-09 | Environment vs Default       | Environment wins                      | Passed        | ✅     |
| D11-10 | No rules match               | Default returned                      | Passed        | ✅     |
| D11-11 | Invalid flag                 | Proper API error                      | Passed        | ✅     |
| D11-12 | Evaluation panel             | Real API result displayed             | Passed        | ✅     |
| D11-13 | Evaluation loading           | Loading indicator displayed           | Passed        | ✅     |
| D11-14 | Evaluation error             | Friendly error displayed              | Passed        | ✅     |
| D12-01 | First evaluation             | Cache miss                            | Passed        | ✅     |
| D12-02 | Same evaluation again        | Cache hit                             | Passed        | ✅     |
| D12-03 | Different user               | Separate cache result                 | Passed        | ✅     |
| D12-04 | Different environment        | Separate cache result                 | Passed        | ✅     |
| D12-05 | Different groups             | Correct cache separation              | Passed        | ✅     |
| D12-06 | Change rollout               | Cache invalidated                     | Passed        | ✅     |
| D12-07 | Change targeting             | Cache invalidated                     | Passed        | ✅     |
| D12-08 | Change environment override  | Cache invalidated                     | Passed        | ✅     |
| D12-09 | Redis unavailable            | Evaluation still works                | Passed        | ✅     |
| D12-10 | Check TTL                    | Cache expires correctly               | Passed        | ✅     |
| D12-11 | Cached result                | CACHED badge displayed                | Passed        | ✅     |
| D12-12 | Fresh result                 | LIVE badge displayed                  | Passed        | ✅     |
| D13-01 | Complete frontend flow       | All features connected                | Passed        | ✅     |
| D13-02 | Complete backend flow        | All APIs work together                | Passed        | ✅     |
| D13-03 | Targeting + rollout          | Correct priority                      | Passed        | ✅     |
| D13-04 | Environment + evaluation     | Correct result                        | Passed        | ✅     |
| D13-05 | Evaluation + Redis           | Cache works                           | Passed        | ✅     |
| D13-06 | Update + cache               | Fresh result returned                 | Passed        | ✅     |
| D13-07 | Full demo                    | Complete workflow works               | Passed        | ✅     |
| D13-08 | Backend tests                | All relevant tests pass               | Passed        | ✅     |
| D13-09 | Frontend build               | Build succeeds                        | Passed        | ✅     |
| D13-10 | Regression                   | Previous features still work          | Passed        | ✅     |
