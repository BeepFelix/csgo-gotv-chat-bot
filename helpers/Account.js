const SteamUser = require("steam-user");
const Coordinator = require("./Coordinator.js");

module.exports = class Account {
	constructor(username, password, serverid, matchid) {
		this.username = username;
		this.password = password;
		this.serverid = serverid;
		this.matchid = matchid;

		this.client = new SteamUser();
		this.coordinator = new Coordinator(this.client);
	};

	login() {
		return new Promise((resolve, reject) => {
			let events = {
				error: (err) => {
					reject(err);
				},
				steamGuard: () => {
					reject(new Error("Steam Guard required for " + this.username));
				},
				loggedOn: async () => {
					await this.client.requestFreeLicense(730);

					this.client.setPersona(SteamUser.EPersonaState.Online);
					this.client.gamesPlayed(730);

					// Establish GameCoordinator connection
					let errGcWelcome = 0;
					let gcWelcome = undefined;
					while (true) {
						gcWelcome = await this.coordinator.sendMessage(
							730,
							this.coordinator.Protos.csgo.EGCBaseClientMsg.k_EMsgGCClientHello,
							{},
							this.coordinator.Protos.csgo.CMsgClientHello,
							{},
							this.coordinator.Protos.csgo.EGCBaseClientMsg.k_EMsgGCClientWelcome,
							this.coordinator.Protos.csgo.CMsgClientWelcome,
							2000
						).catch(() => { });

						if (gcWelcome) {
							break;
						}

						errGcWelcome += 1;

						if (errGcWelcome > 10 /* 2 times 10 = 20 seconds to connect */) {
							reject(new Error("Failed to establish GameCoordinator connection"));
							this.client.logOff();
							return;
						}
					}

					resolve(true);
				}
			}

			let all = () => {
				for (let ev in events) {
					this.client.removeListener(ev, events[ev]);
					this.client.removeListener(ev, all);
				}
			}

			for (let ev in events) {
				this.client.on(ev, events[ev]);
				this.client.on(ev, all);
			}

			this.client.logOn({
				accountName: this.username,
				password: this.password
			});
		});
	};

	logOff() {
		this.client.logOff();
	}

	joinGOTV() {
		return new Promise(async (resolve, reject) => {
			let joinInfo = await this.coordinator.sendMessage(
				730,
				this.coordinator.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_ClientRequestWatchInfoFriends2,
				{},
				this.coordinator.Protos.csgo.CMsgGCCStrike15_v2_ClientRequestWatchInfoFriends,
				{
					request_id: 3,
					serverid: this.serverid.toString(),
					matchid: this.matchid.toString()
				},
				this.coordinator.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_WatchInfoUsers,
				this.coordinator.Protos.csgo.CMsgGCCStrike15_v2_WatchInfoUsers,
				30000
			).catch(reject);

			if (!joinInfo) {
				return;
			}

			let syncPacket = await this.coordinator.sendMessage(
				730,
				this.coordinator.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_GotvSyncPacket,
				{},
				this.coordinator.Protos.csgo.CMsgGCCStrike15_GotvSyncPacket,
				{
					data: {
						instance_id: 0,
						match_id: this.matchid.toString()
					}
				},
				this.coordinator.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_GotvSyncPacket,
				this.coordinator.Protos.csgo.CMsgGCCStrike15_GotvSyncPacket,
				30000
			).catch(reject);

			if (!syncPacket) {
				return;
			}

			resolve({ joinInfo: joinInfo, syncPacket: syncPacket });
		});
	};

	sendMessage(text) {
		return this.coordinator.sendMessage(
			730,
			this.coordinator.Protos.csgo.ECsgoGCMsg.k_EMsgGCCStrike15_v2_GlobalChat,
			{},
			this.coordinator.Protos.csgo.CMsgGCCStrike15_v2_ClientToGCChat,
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
