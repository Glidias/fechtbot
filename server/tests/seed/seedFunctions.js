require('dotenv').config();
const { mongoose, connect } = require('../../db/mongoose');
const { Fecht } = require('../../model/Fecht');
const { User } = require('../../model/User');
const { Character } = require('../../model/Character');
const { CharacterState } = require('../../model/CharacterState');
const { Manuever } = require('../../model/Manuever');

const slugify = require('slugify');

const populateData = async () => {

    await Fecht.deleteMany({}).exec();

    /*
    if (mongoose.connection.readyState === 0) {
        connect();
    }

    let userId;
    let roomId;
    let messageId;

    console.log('\n[PROCESS:SEED] Seeding User Data');

    await User.deleteMany({}).exec();

    for (let user of userSeedData) {
        const userData = await new User({
            handle: slugify(user.username),
            username: user.username,
            email: user.email,
            password: user.password,
            image: gravatar.url(user.email, { s: '220', r: 'pg', d: 'identicon' })
        }).save();
        userId = userData._id;
    }

    console.log('[PROCESS:FIN] Completed Seeding User Data');

    console.log('[PROCESS:SEED] Seeding Room Data');

    await Room.deleteMany({}).exec();

    for (let room of roomSeedData) {
        const roomData = await new Room({
            name: room.name,
            user: userId,
            access: room.password ? false : true,
            password: room.password
        }).save();
        roomId = roomData._id;
    }

    console.log('[PROCESS:FIN] Completed Seeding Room Data');

    console.log('[PROCESS:SEED] Seeding Message Data');

    await Message.deleteMany({}).exec();

    for (let message of messageSeedData) {
        const messageData = await new Message({
            content: message.content,
            user: userId,
            room: roomId
        }).save();
        messageId = messageData._id;
    }

    console.log('[PROCESS:FIN] Completed Seeding Message Data');

    console.log('[PROCESS:SEED] Seeding Reply Data');


    await Reply.deleteMany({}).exec();

    for (let reply of replySeedData) {
        await new Reply({
            content: reply.content,
            user: userId,
            under: messageId
        }).save();
    }

    console.log('[PROCESS:FIN] Completed Seeding Reply Data');


    await Character.deleteMany({}).exec();
    await Game.deleteMany({}).exec();

    console.log('[PROCESS:FIN] Deketed all else');


    */


    await mongoose.connection.close();
};

module.exports = { populateData };
