// Configuration
const config = require("./config.json");
const accounts = require("./accounts.json").splice(0, 10);
console.log("Got " + accounts.length + " account" + (accounts.length === 1 ? "" : "s"));

// Modules
const inquirer = require("inquirer");
const Account = require("./helpers/Account.js");
const Helper = require("./helpers/Helper.js");

// Instances
let bots = [];

(async () => {
	console.log("Logging into main account...");
	let main = new Account(config.main.accountName, config.main.password);
	await main.login();

	let hello = await main.coordinator.sendMessage(
		730,
		main.coordinator.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_MatchmakingClient2GCHello,
		{},
		main.coordinator.Protos.csgo.CMsgGCCStrike15_v2_MatchmakingClient2GCHello,
		{},
		main.coordinator.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_MatchmakingGC2ClientHello,
		main.coordinator.Protos.csgo.CMsgGCCStrike15_v2_MatchmakingGC2ClientHello,
		30000
	);

	let matches = await main.coordinator.sendMessage(
		730,
		main.coordinator.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_MatchListRequestTournamentGames,
		{},
		main.coordinator.Protos.csgo.CMsgGCCStrike15_v2_MatchListRequestTournamentGames,
		{
			eventid: hello.global_stats.active_tournament_eventid
		},
		main.coordinator.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_MatchList,
		main.coordinator.Protos.csgo.CMsgGCCStrike15_v2_MatchList,
		30000
	);

	let liveMatches = matches.matches.filter(m => !m.roundstats_legacy.map && m.watchablematchinfo.server_id && m.watchablematchinfo.match_id);
	if (liveMatches.length <= 0) {
		console.log("No major matches are currently live.");
		main.logOff();
		return;
	}

	let targetMatch = liveMatches[0];

	if (liveMatches.length > 1) {
		let reply_targetMatch = await inquirer.prompt({
			type: "list",
			message: "Multiple matches available, which one would you like to target?",
			name: "match",
			choices: liveMatches.map((m, i) => {
				let teams = m.roundstats_legacy.reservation.tournament_teams.map(t => t.team_name).join(" VS ");
				let map = m.watchablematchinfo.game_map;
				return {
					name: teams + " on " + map,
					value: i
				}
			})
		});

		if (!liveMatches[reply_targetMatch.match]) {
			console.log("Invalid selection.");
			main.logOff();
			return;
		}

		targetMatch = liveMatches[reply_targetMatch.match];
	}

	let teams = targetMatch.roundstats_legacy.reservation.tournament_teams.map(t => t.team_name).join(" VS ");
	let map = targetMatch.watchablematchinfo.game_map;
	console.log("Targetting match " + teams + " on " + map);

	let joinInfo = await main.coordinator.sendMessage(
		730,
		main.coordinator.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_ClientRequestWatchInfoFriends2,
		{},
		main.coordinator.Protos.csgo.CMsgGCCStrike15_v2_ClientRequestWatchInfoFriends,
		{
			request_id: 3,
			serverid: targetMatch.watchablematchinfo.server_id.toString(),
			matchid: targetMatch.watchablematchinfo.match_id.toString()
		},
		main.coordinator.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_WatchInfoUsers,
		main.coordinator.Protos.csgo.CMsgGCCStrike15_v2_WatchInfoUsers,
		30000
	);
	console.log(joinInfo);

	ensureGOTVChatConnection.call(main, joinInfo.watchable_match_infos[0].match_id.toString());
	setInterval(ensureGOTVChatConnection.call, (2 * 60 * 1000), main, joinInfo.watchable_match_infos[0].match_id.toString());

	await new Promise(p => setTimeout(p, 20 * 1000));

	await main.coordinator.sendMessage(
		730,
		main.coordinator.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_GlobalChat_Subscribe,
		{},
		main.coordinator.Protos.csgo.CMsgGCCStrike15_v2_ClientToGCChat,
		{
			match_id: joinInfo.watchable_match_infos[0].match_id.toString()
		}
	);

	console.log("Starting " + accounts.length + " bot" + (accounts.length === 1 ? "" : "s"));

	let chunks = Helper.chunkArray(accounts, config.bots.perChunk);
	for (let i = 0; i < chunks.length; i++) {
		console.log("Processing chunk " + (i + 1) + "/" + chunks.length);

		let toAdd = await Promise.all(chunks[i].map((details) => {
			return new Promise(async (resolve, reject) => {
				console.log("[LOGIN - " + details.username + "] Logging in...");

				let bot = new Account(details.username, details.password, targetMatch.watchablematchinfo.server_id.toString(), targetMatch.watchablematchinfo.match_id.toString());
				let success = await bot.login().catch((err) => {
					console.log("[LOGIN - " + details.username + "] Login failed");
					console.error(err);
					resolve(null);
				});
				if (!success) {
					return;
				}

				console.log("[GOTV - " + details.username + "] Joining GOTV...");
				let result = await bot.joinGOTV().catch((err) => {
					console.log("[GOTV - " + details.username + "] Failed joining GOTV");
					console.error(err);
					resolve(null);
				});
				if (!result) {
					return;
				}

				resolve(bot);
			});
		}));

		toAdd = toAdd.filter(b => b !== null);
		bots.push(...toAdd);

		if ((i + 1) < chunks.length) {
			console.log("Finished chunk " + (i + 1) + "/" + chunks.length + ", waiting " + config.bots.timeBetweenChunks + "ms");
			await new Promise(p => setTimeout(p, config.bots.timeBetweenChunks));
		} else {
			console.log("Finished chunk " + (i + 1) + "/" + chunks.length);
		}
	}

	console.log(bots.length + " account" + (bots.length === 1 ? "" : "s") + " have successfully logged on and joined GOTV");

	// Uncomment this if you want logging, but its relatively useless
	// also I think it just errors at some point
	// main.coordinator.on("receivedFromGC", processChat.bind(null, main));

	processInput();
})();

function processChat(main, msgType, payload) {
	if (msgType !== main.coordinator.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_GlobalChat) {
		return;
	}

	let msg = main.coordinator.Protos.csgo.CMsgGCCStrike15_v2_GCToClientChat.decode(payload);
	msg = main.coordinator.Protos.csgo.CMsgGCCStrike15_v2_GCToClientChat.toObject(msg);

	let ourAccounts = bots.filter(b => b.client.steamID.accountid);
	if (ourAccounts.includes(msg.account_id)) {
		console.log("Ignoring our bot: " + msg.account_id);
		return;
	}

	console.log(msg.account_id + ": " + msg.text);
}

function ensureGOTVChatConnection(matchID) {
	this.coordinator.sendMessage(
		730,
		this.coordinator.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_GotvSyncPacket,
		{},
		this.coordinator.Protos.csgo.CMsgGCCStrike15_GotvSyncPacket,
		{
			data: {
				instance_id: 0,
				match_id: matchID
			}
		},
		this.coordinator.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_GotvSyncPacket,
		this.coordinator.Protos.csgo.CMsgGCCStrike15_GotvSyncPacket,
		5000
	).catch((err) => {
		console.log("GOTV Sync Packet failed for " + matchID);
		console.error(err);
	});
}

async function processInput() {
	let message = await inquirer.prompt({
		type: "input",
		message: "What would you like to send in chat?",
		name: "message"
	});

	if (!message.message || message.message.trim().length <= 0) {
		console.log("Invalid message to send");
		processInput();
		return;
	}
	message.message = message.message.trim();

	let amount = await inquirer.prompt({
		type: "input",
		message: "How often would you like each bot to send this message?",
		name: "amount"
	});

	if (!amount.amount || amount.amount.trim().length <= 0 || !/^\d+/.test(amount.amount)) {
		console.log("Invalid amount");
		processInput();
		return;
	}

	amount.amount = BigInt(amount.amount);
	if (amount.amount > 1000n) {
		console.log("Cannot send more than 1000 per account");
		amount.amount = 1000n;
	}
	amount.amount = Number(amount.amount);

	console.log("Sending \"" + message.message + "\" " + amount.amount + " times per bot, a total of " + (bots.length * amount.amount) + " amount");

	for (let i = 0; i < amount.amount; i++) {
		for (let bot of bots) {
			bot.sendMessage(message.message);
		}
		await new Promise(p => setTimeout(p, config.bots.delay));
	}

	processInput();
}
