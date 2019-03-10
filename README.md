# CSGO GOTV CHAT BOT

Spam messages in the public GOTV+ Broadcast for Majors.

---

**THIS ONLY WORKS DURING CSGO MAJORS DUE TO HOW GOTV DATA IS SENT BETWEEN CLIENT AND SERVER ASWELL AS HOW MESSAGES ARE EXCHANGED BETWEEN CLIENTS**

First version of this was tested for only a short period of time during the ESL Katowice 2019 Major Championship. It had some small issues but I was unable to fully track them down and fix them. I will get back to this once the StarLadder Berlin 2019 Major Championship rolls around.

---

# Config
- **chatRelay**
- - **accountName**: `string` Account login username you want to use to log all messages and get match data for a currently live tournament match
- - **password**: `string` Account login password for the same reason as above
- - telegram
- - - **steamapikey**: `string` Steam API key to convert AccountID into Personaname
- - - **telegramToken**: `string` Bot access token from [@BotFather](https://t.me/BotFather)
- - - **chat_id**: `string` Chat ID where you want to send the message chunks to
- - - **maxMessageLength**: `integer` Max buffer length before sending the message into Telegram
- - - **forceSendTime**: `integer` Time, in milliseconds, of inactivity before forcefully sending the current buffer
- **botsToStart**: `integer` Amount of bots you want to start simultaneously
- **botsPerChunk**: `integer` How many bots you want to log into at once before waiting timeBetweenChunks milliseconds
- **timeBetweenChunks**: `integer` How long we wait between each chunk
- **message**
- - **firstTimeDelay**: `integer` How long we wait after every bot is ready before sending messages
- - **text**: `string` Text to broadcast to all broadcast viewers
- - **sendTimes**: `integer` How many times each bot sends the defined text

# Accounts
The accounts.json is an array of objects, each object has this structure:
- **username**: `string` Account login username
- **password**: `string` Account login password
