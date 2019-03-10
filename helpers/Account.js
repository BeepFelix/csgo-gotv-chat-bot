const SteamUser = require("steam-user");
const GameCoordinator = require("./GameCoordinator.js");

module.exports = class Account {
	constructor(username, password, serverid, matchid) {
		this.username = username;
		this.password = password;
		this.serverid = serverid;
		this.matchid = matchid;

		this.steamUser = new SteamUser();
		this.csgoUser = new GameCoordinator(this.steamUser);
	};

	login() {
		return new Promise((resolve, reject) => {
			this.steamUser.logOn({
				accountName: this.username,
				password: this.password
			});

			let error = (err) => {
				this.steamUser.removeListener("error", error);
				this.steamUser.removeListener("loggedOn", loggedOn);

				reject(err);
			}

			let loggedOn = () => {
				this.steamUser.removeListener("error", error);
				this.steamUser.removeListener("loggedOn", loggedOn);

				this.steamUser.on("appLaunched", appLaunched);

				this.steamUser.setPersona(SteamUser.EPersonaState.Online);
				this.steamUser.gamesPlayed([730]);
			}

			let appLaunched = async (appid) => {
				if (appid !== 730) {
					return;
				}

				this.steamUser.removeListener("appLaunched", appLaunched);

				try {
					let hello = await this.csgoUser.start();

					let mmHello = await this.csgoUser.sendMessage(
						730,
						this.csgoUser.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_MatchmakingClient2GCHello,
						{},
						this.csgoUser.Protos.csgo.CMsgGCCStrike15_v2_MatchmakingClient2GCHello,
						{},
						this.csgoUser.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_MatchmakingGC2ClientHello,
						this.csgoUser.Protos.csgo.CMsgGCCStrike15_v2_MatchmakingGC2ClientHello,
						30000
					);

					resolve({ steamid: this.steamUser.steamID.accountid, hello: hello, mmHello: mmHello });
				} catch(err) {
					this.steamUser.logOff();
					reject(err);
				}
			}

			this.steamUser.on("error", error);
			this.steamUser.on("loggedOn", loggedOn);
		});
	};

	joinGOTV() {
		return new Promise(async (resolve, reject) => {
			// TODO: Add timeout

			let joinInfo = await this.csgoUser.sendMessage(
				730,
				this.csgoUser.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_ClientRequestWatchInfoFriends2,
				{},
				this.csgoUser.Protos.csgo.CMsgGCCStrike15_v2_ClientRequestWatchInfoFriends,
				{
					request_id: 1,
					serverid: this.serverid.toString(),
					matchid: this.matchid.toString()
				},
				this.csgoUser.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_WatchInfoUsers,
				this.csgoUser.Protos.csgo.CMsgGCCStrike15_v2_WatchInfoUsers,
				30000
			);

			let syncPacket = await this.csgoUser.sendMessage(
				730,
				this.csgoUser.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_GotvSyncPacket,
				{},
				this.csgoUser.Protos.csgo.CMsgGCCStrike15_GotvSyncPacket,
				{
					data: {
						match_id: this.matchid.toString()
					}
				},
				this.csgoUser.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_GotvSyncPacket,
				this.csgoUser.Protos.csgo.CMsgGCCStrike15_GotvSyncPacket,
				30000
			);

			resolve({ joinInfo: joinInfo, syncPacket: syncPacket });		
		});
	};

	sendMessage(text) {
		return this.csgoUser.sendMessage(
			730,
			this.csgoUser.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_GlobalChat,
			{},
			this.csgoUser.Protos.csgo.CMsgGCCStrike15_v2_ClientToGCChat,
			{
				match_id: this.matchid.toString(),
				text: text
			},
			undefined,
			undefined,
			30000
		);
	};
}
