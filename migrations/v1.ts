import Discord from "discord.js";
import {connect} from "../services/DataService";
import * as dotenv from "dotenv";
import User from "../models/User";
import dayjs from "dayjs";

dotenv.config();

;(async () => {
    try {
        const serverId = process.env.SERVER;
        const client = new Discord.Client();

        await client.login(process.env.TOKEN);
        await connect();

        const server = await client.guilds.fetch(serverId ?? '')
        if (server) {
            const allUsers = await User.find({});
            const allMembers = await server.members.fetch();
            for (const member of allMembers.array()) {
                const existing = allUsers.find(x => x.discordId === member.id);
                if (!existing) {
                    await new User({
                        discordId: member.id,
                        points: 0,
                        joined: dayjs(member.joinedAt?.toUTCString() ?? new Date().toUTCString()).toISOString()
                    }).save();
                }
            }
            process.exit();
        }
        console.error("unable to find server");
        process.exit();
    } catch (e) {
        console.log(e);
    }
})();
