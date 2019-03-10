// Configuration
const config = require("./config.json");
const accounts = require("./accounts.json");

// Modules
const SteamUser = require("steam-user");
const SteamID = require("steamid");
const request = require("request");
const GameCoordinator = require("./helpers/GameCoordinator.js");
const Account = require("./helpers/Account.js");

// Instances
const steamUser = new SteamUser();
const csgoUser = new GameCoordinator(steamUser);
const botsToIgnore = [];
const bots = [];
const messages = [];
const steam_profile_cache = [];
let forceSendTimeout = setTimeout(sendText, config.chatRelay.telegram.forceSendTime);
let botsStarted = 0;

// Log into Steam
steamUser.logOn({
	accountName: config.chatRelay.accountName,
	password: config.chatRelay.password
});

steamUser.on("error", console.error);
steamUser.on("loggedOn", async () => {
	console.log("Successfully logged into Steam");

	steamUser.setPersona(SteamUser.EPersonaState.Online);
	steamUser.gamesPlayed([730]);
});

steamUser.on("appLaunched", async (appid) => {
	let hello = await csgoUser.start();
	console.log(hello);

	let mmHello = await csgoUser.sendMessage(
		730,
		csgoUser.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_MatchmakingClient2GCHello,
		{},
		csgoUser.Protos.csgo.CMsgGCCStrike15_v2_MatchmakingClient2GCHello,
		{},
		csgoUser.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_MatchmakingGC2ClientHello,
		csgoUser.Protos.csgo.CMsgGCCStrike15_v2_MatchmakingGC2ClientHello,
		30000
	);
	console.log(mmHello);

	let liveGames = await csgoUser.sendMessage(
		730,
		csgoUser.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_MatchListRequestCurrentLiveGames,
		{},
		csgoUser.Protos.csgo.CMsgGCCStrike15_v2_MatchListRequestCurrentLiveGames,
		{},
		csgoUser.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_MatchList,
		csgoUser.Protos.csgo.CMsgGCCStrike15_v2_MatchList,
		30000
	);
	console.log(liveGames);

	let tournamentMatches = liveGames.matches.filter(m => m.roundstats_legacy.reservation.tournament_event !== null);
	console.log(tournamentMatches);

	if (tournamentMatches.length <= 0) {
		console.log("No Tournament Matches");
		steamUser.logOff();
		return;
	}

	let match = tournamentMatches[0];

	let joinInfo = await csgoUser.sendMessage(
		730,
		csgoUser.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_ClientRequestWatchInfoFriends2,
		{},
		csgoUser.Protos.csgo.CMsgGCCStrike15_v2_ClientRequestWatchInfoFriends,
		{
			request_id: 1,
			serverid: match.watchablematchinfo.server_id.toString(),
			matchid: match.watchablematchinfo.match_id.toString()
		},
		csgoUser.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_WatchInfoUsers,
		csgoUser.Protos.csgo.CMsgGCCStrike15_v2_WatchInfoUsers,
		30000
	);
	console.log(joinInfo);

	let syncPacket = await csgoUser.sendMessage(
		730,
		csgoUser.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_GotvSyncPacket,
		{},
		csgoUser.Protos.csgo.CMsgGCCStrike15_GotvSyncPacket,
		{
			data: {
				match_id: joinInfo.watchable_match_infos[0].match_id.toString()
			}
		},
		csgoUser.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_GotvSyncPacket,
		csgoUser.Protos.csgo.CMsgGCCStrike15_GotvSyncPacket,
		30000
	);
	console.log(syncPacket);

	setInterval(async () => {
		await csgoUser.sendMessage(
			730,
			csgoUser.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_GotvSyncPacket,
			{},
			csgoUser.Protos.csgo.CMsgGCCStrike15_GotvSyncPacket,
			{
				data: {
					match_id: joinInfo.watchable_match_infos[0].match_id.toString()
				}
			},
			csgoUser.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_GotvSyncPacket,
			csgoUser.Protos.csgo.CMsgGCCStrike15_GotvSyncPacket,
			30000
		);
	}, (2 * 60 * 1000));

	await csgoUser.sendMessage(
		730,
		csgoUser.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_GlobalChat_Subscribe,
		{},
		csgoUser.Protos.csgo.CMsgGCCStrike15_v2_ClientToGCChat,
		{
			match_id: joinInfo.watchable_match_infos[0].match_id.toString()
		},
		undefined,
		undefined,
		30000
	);
	console.log("Starting bots...");

	if (accounts.length < config.botsToStart) {
		console.log("Not enough accounts available. Need " + config.botsToStart + ", have " + accounts.length);
		return;
	}

	let accountsToUse = accounts.slice(0, config.botsToStart);
	let chunks = chunkArray(accountsToUse, config.botsPerChunk);

	for (let chunk of chunks) {
		await new Promise(async (resolve, reject) => {
			for (let loginDetails of chunk) {
				console.log("Logging into " + loginDetails.username);

				accountHandler(loginDetails.username, loginDetails.password,  match.watchablematchinfo.server_id.toString(), joinInfo.watchable_match_infos[0].match_id.toString(), resolve);

				await new Promise(r => setTimeout(r, 100));
			}
		});
	}

	console.log("All accounts successfully logged into Steam, started CSGO, established GC connection and joined GOTV");
	console.log("Sending messages in " + Math.round(config.message.firstTimeDelay / 1000) + " second" + (Math.round(config.message.firstTimeDelay / 1000) === 1 ? "" : "s"));

	await new Promise(r => setTimeout(r, config.message.firstTimeDelay));

	for (let bot of bots) {
		for (let i = 0; i < config.message.sendTimes; i++) {
			bot.sendMessage(config.message.text);
		}
	}
});

csgoUser.on("message", (msgType, payload) => {
	if (msgType === csgoUser.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_GlobalChat) {
		let msg = csgoUser.Protos.csgo.CMsgGCCStrike15_v2_GCToClientChat.decode(payload);

		if (botsToIgnore.includes(msg.account_id)) {
			console.log("Ignoring our bot: " + msg.account_id);
			return;
		}

		console.log(msg);

		let sid = SteamID.fromIndividualAccountID(msg.account_id);
		let index = steam_profile_cache.map(s => s.steamid).indexOf(sid.toString());
		let profile = undefined;

		for (let i = steam_profile_cache.length - 1; i >= 0; i--) {
			if (Date.now() - steam_profile_cache[index].timestamp < 10 * 60 * 1000) {
				continue;
			}

			steam_profile_cache.splice(index, 1);
		}

		if (index <= -1) {
			profile = await new Promise((resolve, reject) => {
				request("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=" + config.chatRelay.telegram.steamapikey + "&steamids=" + sid.toString(), (err, res, body) => {
					if (err) {
						reject(err);
						return;
					}

					let json = undefined;
					try {
						json = JSON.parse(body);
					} catch (e) { };

					if (json === undefined) {
						reject(body);
						return;
					}

					if (typeof json.response === "undefined") {
						reject(json);
						return;
					}

					resolve(json.response.players[0]);
				});
			});
		} else {
			profile = steam_profile_cache[index];
		}

		if (typeof profile === "undefined") {
			return;
		}

		if (steam_profile_cache.map(s => s.steamid).includes(profile.steamid) === false) {
			steam_profile_cache.push({
				steamid: profile.steamid,
				personaname: profile.personaname,
				timestamp: Date.now()
			});
		}

		let chatMsg = "[" + profile.personaname.replace(/\[/g, "").replace(/\]/g, "") + "](https://steamcommunity.com/profiles/" + profile.steamid + "): " + msg.text;
		messages.push(chatMsg);

		if (messages.join("\n").length >= config.chatRelay.telegram.Length) {
			sendText();
		}
	}
});

async function accountHandler(username, login, serverid, matchid, resolve) {
	const acc = new Account(username, login, serverid, matchid);
	let login = await acc.login().catch(console.error);

	if (typeof login === "undefined") { // Login failed
		isFinished(resolve);
		return;
	}

	let join = await acc.joinGOTV().catch(console.error);
	if (typeof join === "undefined") {
		isFinished(resolve);
		return;
	}

	botsToIgnore.push(login.steamid);
	bots.push(acc);

	isFinished(resolve);

	console.log("Successfully logged into " + username);
}

async function isFinished(resolve) {
	botsStarted += 1;

	if (botsStarted >= config.botsPerChunk) {
		botsStarted = 0;

		await new Promise(r => setTimeout(r, config.timeBetweenChunks));
		resolve();
	}
}

function sendText() {
	clearTimeout(forceSendTimeout);
	setTimeout(sendText, config.chatRelay.telegram.forceSendTime);

	if (messages.length <= 0) {
		return;
	}

	let temp = messages;
	let toSend = messages.join("\n");
	messages.length = 0;

	request("https://api.telegram.org/bot" + config.chatRelay.telegram.telegramToken + "/sendMessage?chat_id=" + config.chatRelay.telegram.chat_id + "&text=" + encodeURIComponent(toSend) + "&parse_mode=markdown&disable_web_page_preview=true&disable_notification=true", (err, res, body) => {
		if (err) {
			console.error(err);
			return;
		}

		let botJson = undefined;
		try {
			botJson = JSON.parse(body);
		} catch (e) { };

		if (botJson === undefined) {
			console.log(body);
			return;
		}

		if (botJson.ok === true) {
			return;
		}

		console.log(temp);
		console.log(botJson);
	});
}

// Copied from: https://ourcodeworld.com/articles/read/278/how-to-split-an-array-into-chunks-of-the-same-size-easily-in-javascript
function chunkArray(myArray, chunk_size) {
	var tempArray = [];

	for (let index = 0; index < myArray.length; index += chunk_size) {
		myChunk = myArray.slice(index, index + chunk_size);
		tempArray.push(myChunk);
	}

	return tempArray;
}
