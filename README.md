# CSGO GOTV CHAT BOT

Spam messages in the public GOTV+ Broadcast for Majors.

Sometimes randomly crashes ¯\\\_(ツ)_/¯

---

# Config
- **main**: `object`
- - **accountName**: `string` Username of the first account used to fetch required data
- - **password**: `string` Password for above account
- **bots**: `object`
- - **perChunk**: `number` Limit the amount of accounts to get from our account list. *Do not set this higher than your actual amount of bots*
- - **timeBetweenChunks**: `number` Time in miliseconds to wait between logging in each chunk
- - **delay**: `number` Time in milliseconds to wait between sending messages

# Accounts
The accounts.json is an array of objects, each object has this structure:
- **username**: `string` Account login username
- **password**: `string` Account login password
