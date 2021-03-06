const TEMP_NOTIFY_PREFIX = "^ ";

function deleteMessage(message) {
    message.delete().catch((e) => {
        console.log(e);
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function sendTempMessage(text, channel) {
    channel.send(TEMP_NOTIFY_PREFIX + text)
    .then((message) => {
    delayedDelete(message, 4000);
    });
}

function sendTempMessageDM(text, user) {
    user.send(TEMP_NOTIFY_PREFIX + text)
    .then((message) => {
    delayedDelete(message, 4000);
    });
}

function stripSpaces(str) {
    return str.replace(/ /g, "");
}

/*
function sendTempNotification(text, channel) {
    channel.fetchMessages({ limit: 1 }).then(messages => {
    let lastMessage = messages.first();
    if (lastMessage.author.text !== text) {
       sendTempMessage(text, channel);
    }
    })
}
*/

async function delayedDelete(message, ms) {
    await sleep(ms);
    deleteMessage(message);
    }



module.exports = {
    sleep: sleep,
    sendTempMessage: sendTempMessage,
    sendTempMessageDM: sendTempMessageDM,
    delayedDelete: delayedDelete,
    deleteMessage: deleteMessage,
    stripSpaces: stripSpaces,
    TEMP_NOTIFY_PREFIX: TEMP_NOTIFY_PREFIX
   // sendTempNotification: sendTempNotification
}