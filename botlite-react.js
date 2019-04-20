/** Dotenv Environment Variables */
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const {sendTempMessage, sendTempMessageDM, stripSpaces, TEMP_NOTIFY_PREFIX, asyncForEach} = require('./server/modules/general');

const Discord = require('discord.js');
const client = new Discord.Client();

const {Dice} = require('dice-typescript');
const DICE = new Dice();

const Hashids = require('hashids');
const HASH_IDS_BITS = 8;
const HASH_IDS_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
function getHashIds(randomSalt) {
  return new Hashids(PRIVATE_SALT+randomSalt, HASH_IDS_BITS, HASH_IDS_CHARS);
}

const SYMBOLS = {
  dice: "🎲", //:game_die:
  x: "❌",
  confused: "😕",
  confounded: "😖",
  question: "❓",
  //question: ""
  moveOkay: "👌",
  exclaim: "❗",
  okie: "👌",
  exclaim_grey: "❕",
  play: "▶",
  x_black: "✖",
  tick_blue: "☑",
  arrow_doubleup: "⏫",
  turnTick: "✅"
};

const FORWARDED_PACKETS = ["MESSAGE_REACTION_ADD", "MESSAGE_REACTION_REMOVE", "MESSAGE_UPDATE"];
const CHAR_NAME_REGSTR = '(<@[0-9]+>(?:[ ]*:[ ]*[^@#,`<> \n]+)?)';
const USER_ID_REGSTR = '<@[0-9]+>';
const INLINE_ROLL_REGSTR = '`([^`\n]+)`+';

const REACT_MSG_PREFIX = "~~ ";

const PREFIX = process.env.PREFIX;
const PRIVATE_SALT = process.env.SALT || "xgSw292(RJ*(Rr";

const BUFFER_FETCH = 5;

const ID_SPLITTER = ":::"

function errHandler(e) {
  console.log(e);
}

function getBackTickedContents(contents) {
 return contents.startsWith('`') && contents.endsWith('`') ? contents.slice(1, contents.length-1) : contents;
}

function emptyHandler(e) {

}

function getPossibleRollResultsStr(roll) {
  let results = tryRoll(roll);
  if (!results || results.errors.length) {
    roll = "";
    return "{invalid roll expression}";
  }
  return stripSpaces(results.renderedExpression) + SYMBOLS.dice + " " +(results.successes >= 1 ? "**"+results.successes+"**" : results.successes)+"("+results.failures+")" + " = "+results.total;
}

function getHashedIndex(idx) {
  var randomSalt = Math.random().toString();
  var hashids = getHashIds(randomSalt);
  //
  var id = hashids.encode(idx);
  return id+":"+randomSalt;
}

async function getCompletedReactMessages(footerMessage, channel, linesRequired) {
   //footer.id;
  let footerContent = footerMessage.embeds[0].description;
  let si = footerContent.indexOf(" ");
  let total = parseInt(footerContent.slice(0, si));
  let collectArr = [];
  let c = await channel.fetchMessages({ after:footerMessage.id, limit:total+BUFFER_FETCH });
  c = c.array();
  let count = 0;
  let i = c.length;
  let spl;
  while(--i > -1) {
    let m  = c[i];
    if (m.author.id === client.user.id && m.content.startsWith(REACT_MSG_PREFIX) 
      && (spl=m.content.split("\n")).length>=linesRequired
      && getBackTickedContents(spl[0].split(ID_SPLITTER)[1]) === footerMessage.id
      ) {
      count++;
      collectArr.push(m);
      if (count >= total) {
        return collectArr;
      }
    }
  }
  return null;
}

function getDMRelayData(message) {
  let contents = message.content.split(ID_SPLITTER)[1];
  contents = getBackTickedContents(contents);
  contents = contents.split(":");
  return {
    channelId: contents[0].slice(2, contents[0].length-1),
    messageId: contents[1]
  }
}

function decomposeMention(mention) {
  let si = mention.indexOf(":");
  return si >= 0 ? {id: mention.slice(2, si-1), handle:mention.slice(si+1)} : {id: mention.slice(2, mention.length-1), handle: ""};
}

function decomposeReact(str) {
  var spl = str.split("\\");
  var emoticon;
  var roll = "";
  if (spl.length >= 2) {
   emoticon = spl.pop();
   roll = spl.join("\\");
  } else {
    emoticon = spl[0];
  }
  return {emoticon, roll}
}


function errCatcher(e) {
  console.log(e);
}

function tryRoll(roll) {
  let result;
  try {
    result = DICE.roll(roll);
  } catch(e) {
    return null;
  }
  return result;
}

function getCharNameRegMatches(contents) {
  let matches = contents.match(new RegExp(CHAR_NAME_REGSTR, "g"));
  if (!matches) return null;
  let len = matches.length;
  let i;
  let si;
  let str;
  for (i=0; i<len; i++) {
    str = matches[i];
    si = str.indexOf(":");
    if (si >= 0) {
      matches[i] = str.slice(0, si).trim() + ":" + str.slice(si+1).trim();
    }
  }
  matches = [...new Set(matches)];
  return matches;
}

function getJSONReactsFromFooterMessage(message) {
  return JSON.parse( getBackTickedContents(message.embeds[0].description.split("\n")[1])  );
}

function getReactionIdx(arr, symbol) {
  let i = arr.length;
  let spl;
  let emoji;
  while(--i > -1) {
    spl = arr[i].split("\\");
    emoji = spl[spl.length-1];
    if (emoji === symbol) return i;
  }
  return -1;
}

async function sendDM(pubChannel, namer, messageReaction, user, dmReacts) {
  let dmsg = await user.send(REACT_MSG_PREFIX+ namer + " " + "please choose " + ID_SPLITTER + "<#"+pubChannel.id+">:"+messageReaction.message.id + "\n`"+JSON.stringify(dmReacts)+ "`");
  let i;
  for (i=0; i<dmReacts.length; i++) {
    await dmsg.react(decomposeReact(dmReacts[i]).emoticon);
  }
}

async function messageCheckReactions(message, remainingContents, channel, command) {
  let matches = getCharNameRegMatches(remainingContents);
  if (!matches || !matches.length) {
    message.reply(TEMP_NOTIFY_PREFIX+"Please mention users/(:characters) for reaction phase!");
    return;
  }

  remainingContents = remainingContents.replace(new RegExp(CHAR_NAME_REGSTR, "g"), "");
  
  remainingContents= remainingContents.trim();
  if (!remainingContents) {
    message.reply(TEMP_NOTIFY_PREFIX+"Please supply a JSON array of reactions");
    return;
  }
  let parsedJSON;
  remainingContents =getBackTickedContents(remainingContents);
  try {
    parsedJSON = JSON.parse(remainingContents);
    if ( !(Array.isArray(parsedJSON)) ) {
      throw new Error("invalid type of parsed json: " + (typeof parsedJSON));
    }
  } catch(err) {
    message.reply(TEMP_NOTIFY_PREFIX+"Invalid parsed JSON array");
    return;
  }
  if (parsedJSON.length === 0) {
      message.reply(TEMP_NOTIFY_PREFIX+"Need at least 1 string of reactions");
    return;
  }

  let i = 0;
  let len = parsedJSON.length;
  let reacts = parsedJSON[0];
  let dmReacts = parsedJSON[1];
  
  //[["1d10\\😡","1d10\\😯","1d10\\😷"], ["😡","😯","😷"]]
  let footer;
  if (dmReacts) {
      footer = await channel.send(new Discord.RichEmbed({description:matches.length + " of you: Check (DM) direct messages from me AFTER you've tapped your reaction down below:\n"+"`"+JSON.stringify(parsedJSON)+"`"}));
  } else {
    footer = await channel.send(new Discord.RichEmbed({description:matches.length + " of you: Tap your reactions below:\n"}));
  }

  // footerId, matches, dmReacts
  len = matches.length;
  let collectArr = [];
  for (i= 0; i< len; i++) {
    let m2 = await channel.send(REACT_MSG_PREFIX + matches[i] + (dmReacts ? " -- *drops in* " : " -- *reacts with* ") + ID_SPLITTER+ "`"+footer.id + "`");
    collectArr.push(m2);
  }

  i = collectArr.length;
  while(--i > -1) {
    let k;
    let m2 = collectArr[i];
    for (k=0; k < reacts.length; k++) {
      let r = decomposeReact(reacts[k]);
      await m2.react(r.emoticon);
    }
  }
}


client.on('raw', async packet => {

  // We don't want this to run on unrelated packets
  if (!FORWARDED_PACKETS.includes(packet.t)) return;

  if (client.user.id === packet.d.user_id) {
    return;
  }
  //console.log(packet);
  let messageId = packet.t === "MESSAGE_UPDATE" ? packet.d.id : packet.d.message_id;

  // Grab the channel to check the message from
  let channel = client.channels.get(packet.d.channel_id);
  if (!channel) {
    if ( packet.t === "MESSAGE_REACTION_ADD" ) {
      let tuser = client.users.get(packet.d.user_id);
      if (tuser) {
        tuser.send(TEMP_NOTIFY_PREFIX+"Sorry. There was downtime and I was asleep.\nPlease re-request a new direct-message (DM) by bumping a reaction button again at the public channel's message mentioning you!")
      }
    }
    return;
  }
 
  // There's no need to emit if the message is cached, because the event will fire anyway for that
  if (channel.messages.has(messageId)) return;

  channel.fetchMessage(messageId).then(message => {
    // Emojis can have identifiers of name:id format, so we have to account for that case as well
    if (packet.t === 'MESSAGE_REACTION_ADD' || packet.t === 'MESSAGE_REACTION_REMOVE') {
      let emoji = packet.d.emoji.id ? `${packet.d.emoji.name}:${packet.d.emoji.id}` : packet.d.emoji.name;
      // This gives us the reaction we need to emit the event properly, in top of the message object
      let reaction = message.reactions.get(emoji);
      // Adds the currently reacting user to the reaction's users collection.
      if (reaction) reaction.users.set(packet.d.user_id, client.users.get(packet.d.user_id));
      // Check which type of event it is before emitting
      if (packet.t === 'MESSAGE_REACTION_ADD') {
        client.emit('messageReactionAdd', reaction, client.users.get(packet.d.user_id));
      } else { 
        client.emit('messageReactionRemove', reaction, client.users.get(packet.d.user_id));
      }
     } else if (packet.t === 'MESSAGE_UPDATE') {
      client.emit('messageUpdate', null, message);
     }
  });
  
});



client.on("messageReactionAdd", async (messageReaction, user) => {
  if (user.bot) {
    return;
  }

  if (!messageReaction.message.content.startsWith(REACT_MSG_PREFIX) && !messageReaction.message.content.startsWith(PREFIX)) {
    return;
  }

  if (messageReaction.message.content.startsWith(REACT_MSG_PREFIX) && 
    messageReaction.message.author.id === client.user.id && 
    messageReaction.message.mentions.users.has(user.id)) {

    let channel = messageReaction.message.channel;  
    let lineLimit = channel.type !== "dm" ? 2 : 3;
    let lineLimitReached = messageReaction.message.content.split("\n").length >= lineLimit;
    if (lineLimitReached && channel.type === "dm") { // already reacted if got 2 lines or more
      //console.log("DM line limit reached");
      return;
    }
  
    let dmRelayData;
    if (channel.type === "dm") {
      dmRelayData = getDMRelayData(messageReaction.message);
    }
    let pubChannel = channel.type !== "dm" ? channel : client.channels.get(dmRelayData.channelId);
    if (!pubChannel) {
      console.log("Could not find pubChannel exception");
      return;
    }

    let pubMessage;
    if (channel.type === "dm") {
      pubMessage = await pubChannel.fetchMessage(dmRelayData.messageId);
      if (!pubMessage) {
        user.send(TEMP_NOTIFY_PREFIX+ "Expired :: We could not find the request DM message reaction request anymore from the pub channel.\nIt might have been deleted!")
        return;
      } 
      if (pubMessage.content.split("\n").length >= 3) {
          user.send(TEMP_NOTIFY_PREFIX+ "You've already reacted for that reaction phase!")
        return;
      }
    } else {
      pubMessage = messageReaction.message;
    }

    let symbol = messageReaction.emoji.name;

    let namer =  messageReaction.message.content.match(new RegExp(CHAR_NAME_REGSTR, "g"))[0];
    //let namerDec = decomposeMention(namer);
    let member = pubChannel.members.get( messageReaction.message.mentions.users.first().id);
     if (!member) {
      console.log("Could not find member exception");
      return;
    }

    let footer;
    let messageLineSplit = pubMessage.content.split("\n");
    footer = messageLineSplit[0].split(ID_SPLITTER)[1];
    footer = getBackTickedContents(footer);
    footer = await pubChannel.fetchMessage(footer).catch(emptyHandler);
    
    if (!footer) {
      console.log("Could not find footer exception for reaction");
      return;
    }
    let reactData = getJSONReactsFromFooterMessage(footer);
    let reactDataArray = reactData;

    reactData = channel.type === "dm" ? reactData[1] : reactData[0];
    
    if (lineLimitReached) {
      if (pubMessage.content.split("\n").length < 3) {
        let relayEmoIndex = parseInt(messageLineSplit[1].split(".")[0]) - 1;
        let relayEmoticon = decomposeReact(reactData[relayEmoIndex]).emoticon;
        let dmReacts = reactDataArray[1].filter((d)=>decomposeReact(d).emoticon!==relayEmoticon);
        // dmReacts zero length exception?
        sendDM(pubChannel, namer, messageReaction, user, dmReacts);
       }
       return;
    }
      
    
    let reactIdx =  getReactionIdx(reactData, symbol);
    if (reactIdx < 0) {
      //console.l
      console.log("react idx not found");
      return;
    }

    let react = decomposeReact(reactData[reactIdx]);
    
    let rollSuffix = "";
    if (react.roll && channel.type !== "dm") {
      // todo: add rolling suffix
      rollSuffix = " "+getPossibleRollResultsStr(react.roll);
    }  
    

    await messageReaction.message.edit(messageReaction.message.content+"\n"+(reactIdx+1)+". "+react.emoticon + rollSuffix);

    if (channel.type === "dm") {
      // update relay data back
      //dmRelayData.messageId
     
      await pubMessage.edit(pubMessage.content + "\n`"+getHashedIndex(reactIdx)+"`");
      // Now, check if everything is complete from footer (3 lines)
      let completedMessages = await getCompletedReactMessages(footer, pubChannel, 3);
      if (completedMessages) {
        asyncForEach(completedMessages, async (m)=> {
          let mLines = m.content.split("\n");
          let spl = getBackTickedContents(mLines[2]).split(":");
          let hashIds =getHashIds(spl[1])
          let reactIdx = parseInt( hashIds.decode(spl[0]) );
          let react = decomposeReact(reactData[reactIdx]);
         
           let rollSuffix = "";
            // todo: add rolling suffix
           if (react.roll) {
            rollSuffix = " "+getPossibleRollResultsStr(react.roll);
           }
           mLines[2] = (reactIdx+1)+". "+react.emoticon + rollSuffix; 
           await m.edit(mLines.join("\n"));
        });
        
        await pubChannel.send(new Discord.RichEmbed({description:"Reactions has finished! "+ID_SPLITTER+"`"+footer.id+"`"}));
      }
      return;
    } else {
      if (reactDataArray[1]) {  // send DM first
        let dmReacts = reactDataArray[1].filter((d)=>decomposeReact(d).emoticon!==react.emoticon);
        // dmReacts zero length exception?
        await sendDM(pubChannel, namer, messageReaction, user, dmReacts);
      } else { // Now, check if everyting is complete from footer (2 lines)
        let completedMessages = await getCompletedReactMessages(footer, pubChannel, 2);
        if (completedMessages) {
          await pubChannel.send(new Discord.RichEmbed({description:"Reactions has finished! "+ID_SPLITTER+"`"+footer.id+"`"}));
        }
      }
    }
  
  }

});

client.on("message", async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) {
    return;
  }

  var contentIndex = message.content.indexOf(" ");
  var command = contentIndex >= 0 ? message.content.slice(1, contentIndex) : message.content.slice(1);
  var remainingContents = contentIndex>=0 ? message.content.slice(contentIndex+1) : "";
  if (remainingContents) remainingContents = remainingContents.trim();
  else remainingContents = "";

  var channel = message.channel;

  // Commands for both DM and non DM channels

  switch(command) {
    case 'roll':
    case 'rolli':
    case 'r':
    case 'ri':
    case 'say':
    case 's': 
    
    return;
    case 'react': break;
    default: return;
  }
  

  if (channel.type === "dm") {
    message.reply("Not here dude...this is a DM channel..");;
    return;
  }

  if (command === 'react') {
    messageCheckReactions(message, remainingContents, channel, command);
  }

});


client.on("ready", () => {
  console.log("FechtBotLite Online!");
});

client.login(process.env.TOKEN);