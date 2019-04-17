/** Dotenv Environment Variables */
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

/** Connect to MongoDB */
const mongoose = require('mongoose');
mongoose.set('useFindAndModify', false);

require('./server/db/mongoose');

const Discord = require('discord.js');
const client = new Discord.Client();

const { Fecht } = require('./server/model/Fecht');
const { User } = require('./server/model/User');
const { DMReact } = require('./server/model/DMReact');
const { Manuever } = require('./server/model/Manuever');
const {sendTempMessage, sendTempMessageDM, stripSpaces} = require('./server/modules/general');
const {getSortingFunctionOf, getSortMethodsForField} = require('./server/modules/sorting');
const SORT_MANUEVERS = getSortMethodsForField("slot");

const {Dice} = require('dice-typescript');
const DICE = new Dice();

const ERROR_DICE = 1;
const ERROR_HANDLE = 2;
const ERROR_SLOT = 4;

const COLOR_OUT_OF_GAME = 0x000000;
const COLOR_GM = 0xF4A61C;
const COLOR_BOT = 0x7788d9;
const COLOR_MAIN = 0x888888;
const COLOR_GAMEOVER = 0xdd33ee;
const COLOR_GAMESTART = COLOR_GAMEOVER;

const OUTGAME_PREFIX = "://";
const GM_PREFIX = ":(gm):";

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

const PREFIX = process.env.PREFIX;

const RESOLVE_MENTION_SPLIT = " ~~~ ";



const TITLES = {
  turnFor: ":: Turn for ::",
  turnEnded: ":: Turn ended ::",
  turnEnding: ".. Ending turn ..",
  resolvingPlays: ".. Resolving plays ..",
  settingUpResolvePlays: ".. Setting up resolve plays ..",
  resolution: ":: Resolution of Plays ::"
};

const DESCS = {
  pleaseWait: "Please wait..."
};

function getTurnOptions() {
  //`!turn >`/
  return "`!turn @[mentions]`";
}

function getCarryOnMsg() {
  return "GM may: "+getTurnOptions()+" / `!p >` to carry on.";
}

function isBotEmbed(m) {
  if (!m.embeds || !m.embeds[0]) return false;
  let color = m.embeds[0].color;
  return color === COLOR_BOT || color === COLOR_GAMEOVER || color === COLOR_GAMESTART || color === COLOR_MAIN;
}

const delayWait = (msec) => new Promise((resolve) => setTimeout(resolve, msec));

// cache for channel_id to fechtId!
const CHANNELS_FECHT = {};

const FECHT_COMMANDS = {
  "turn": true,
  "say": true,
  "phase": true
};

const FORWARDED_PACKETS = ["MESSAGE_REACTION_ADD", "MESSAGE_REACTION_REMOVE", "MESSAGE_UPDATE"];

const CHAR_NAME_REGSTR = '(<@[0-9]+>(?:[ ]*:[ ]*[^@#,`<> \n]+)?)';
const USER_ID_REGSTR = '<@[0-9]+>';
const INLINE_ROLL_REGSTR = '!`([^`]+)`+';

function tryRoll(roll) {
  let result;
  try {
    result = DICE.roll(roll);
  } catch(e) {
    return null;
  }
  return result;
}

function replaceInlineRollMatches(t, r) {
  let results = tryRoll(r);
  if (results) {
    results = stripSpaces(results.renderedExpression) + SYMBOLS.dice +" " + results.successes+"("+results.failures+")" + " = "+results.total;
  }
  return results ? "**"+r.replace(/\\/g, "\\\\")+"** `"+results+"`" : "!\\`"+r+"\\`";
}

async function updateNewBodyFooter(f, channel, miscTurnCount) {
  let oldBodyId = f.latest_body_id;
  let oldFooterId = f.latest_footer_id;
  let newBody = await channel.send(await getBodyRenderOfFecht(f, channel));
  let newFooter = await channel.send(new Discord.RichEmbed({title:TITLES.turnEnded, color:COLOR_BOT, description: DESCS.pleaseWait}));
  let payload =  { latest_footer_id: newFooter.id, latest_body_id: newBody.id};
  if (miscTurnCount !== undefined) {
    payload.miscTurnCount = miscTurnCount;
    f.miscTurnCount = payload.miscTurnCount; 
  }
  let newF = await Fecht.updateOne({channel_id:channel.id}, payload);
  return {footer:newFooter, body:newBody, f:newF};
}

function getCharNameRegMatches(contents) {
  let matches = contents.match(new RegExp(CHAR_NAME_REGSTR, "g"));
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

function getInlineRolls(contents) {
  return contents.replace(new RegExp(INLINE_ROLL_REGSTR, "g"), replaceInlineRollMatches);
}

async function editManueverMsg(message) {
  let content = message.content.split("\n")[0];

  let split = content.split(RESOLVE_MENTION_SPLIT);
  
  let dec = decomposeMention(split[1]);
 
  let splits2 = split[0].split(" ");
  //splits2[1] = " *"+splits2[1]+"* ";
  splits2.shift();
  let slot = parseFloat(splits2[0]);

  // to validate if slot is relavant!

  await Manuever.deleteOne({channel_id:message.channel.id, slot:slot})
  let str =  splits2.join(" ");
  //console.log(str);
  //str.replace(SYMBOLS.dice, ":");
  let rem = isValidManeverExpr(str);
  rem.handle = dec.handle;
  return rem;
}

async function rollResolvableMsg(message) {
  let split = message.content.split(RESOLVE_MENTION_SPLIT);
  
  let dec = decomposeMention(split[1]);
 
  let splits2 = split[0].split(" ");
  //splits2[1] = " *"+splits2[1]+"* ";
  splits2.shift();
  let slot = parseFloat(splits2[0]);
  await Manuever.deleteOne({channel_id:message.channel.id, slot:slot})
  let str =  splits2.join(" ");
  //console.log(str);
  //str.replace(SYMBOLS.dice, ":");
  let rem = isValidManeverExpr(str);

  rem.handle = dec.handle;
  return await rollMessageFinal(message, rem, dec.id);
}

async function rollMessage(message, userCharHash) {
  let rem = await isValidManueverMsg(message.content, message.channel);
  if (!rem.handle && userCharHash) {
    if (userCharHash.defaulting[message.author.id] != null) {
      rem.handle = userCharHash.defaulting[message.author.id];
    }
  }
  return await rollMessageFinal(message, rem, message.author.id);
}

async function rollMessageFinal(message, rem, userid) {
  var msg = "<@"+userid+">";
  if (rem.handle) {
    msg += ":"+rem.handle.trim();
  }
  msg += " **"+rem.str.trim()+"**";
  if (rem.roll) {
    msg += " `"+rem.roll.trim()+"`";
  }
  if (rem.comments) {
    msg += " *# "+rem.comments.trim()+"*"
  }
  if (rem.roll) {
    let results = DICE.roll(rem.roll);  
    msg += "\n"+stripSpaces(results.renderedExpression) + SYMBOLS.dice + " " +(results.successes >= 1 ? "**"+results.successes+"**" : results.successes)+"("+results.failures+")" + " = "+results.total;
  }
  await message.channel.send("|"+msg);
}

async function rollManuever(manuever, channel) {
  var msg = manuever.mention;
  msg += " **"+manuever.label+"**";
  if (manuever.roll) {
    msg += " `"+manuever.roll+"`";
  }
  if (manuever.comments) {
    msg += " *# "+manuever.comments+"*"
  }
  if (manuever.roll) {
    let results = DICE.roll(manuever.roll);  
    msg += "\n"+stripSpaces(results.renderedExpression) + SYMBOLS.dice +" " + (results.successes >= 1 ? "**"+results.successes+"**" : results.successes)+"("+results.failures+")" + " = "+results.total;
  }
  await channel.send("|"+msg);
}


async function rollManuever2(manuever, channel) {
  let dec = decomposeMention(manuever.mention);
  let member = channel.members.get(dec.id)
  let user =  member.user;  // how to
  if (!member) return await rollManuever(manuever, channel);

  var msg = "";

  msg += " **"+manuever.label+"**";
  if (manuever.roll) {
    msg += " `"+manuever.roll+"`";
  }
  if (manuever.comments) {
    msg += " *# "+manuever.comments+"*"
  }
  if (manuever.roll) {
    let results = DICE.roll(manuever.roll);  
    msg += "\n"+results.renderedExpression + SYMBOLS.dice + " ("+(results.successes >= 1 ? "**"+results.successes+"**" : results.successes)+"/"+results.failures+")" + " = "+results.total;
  }


   await channel.send(new Discord.RichEmbed({
    "description": msg, 
    "author": {
      "name": member.displayName+(dec.handle ? ":"+dec.handle : ""), // + (remainingContents.length > 1 ? remainingContents[0] : ""),
      "icon_url": user.displayAvatarURL
    }
  }));
}


async function rollMessage2(message, userCharHash) {
  let member = message.channel.members.get(message.author.id);
  let user = message.author;
  if (!member) return await rollMessage(message);

  let rem = await isValidManueverMsg(message.content, message.channel);
  if (!rem.handle && userCharHash) {
    if (userCharHash.defaulting[msg] != null) {
      rem.handle = userCharHash.defaulting[msg];
    }
  }

  var msg = "";

  msg += " **"+rem.str.trim()+"**";
  if (rem.roll) {
    msg += " `"+rem.roll.trim()+"`";
  }
  if (rem.comments) {
    msg += " *# "+rem.comments.trim()+"*"
  }
  if (rem.roll) {
    let results = DICE.roll(rem.roll);  
    msg += "\n"+results.renderedExpression + SYMBOLS.dice + " ("+(results.successes >= 1 ? "**"+results.successes+"**" : results.successes)+"/"+results.failures+")" + " = "+results.total;
  }
  
  await message.channel.send(new Discord.RichEmbed({
    "description": msg, //remainingContents[remainingContents.length-1]
    "author": {
      "name": member.displayName+(rem.handle ? ":"+rem.handle.trim() : ""), // + (remainingContents.length > 1 ? remainingContents[0] : ""),
      "icon_url": user.displayAvatarURL
    }
  }));
 
}

client.on("ready", () => {
  console.log("FechtBot Online!");
});

function errHandler(e) {
  console.log(e);
}
function emptyHandler(e) {

}

function errCatcher(e) {
  console.log(e);
}

function getUserFooterMatches(message) {
  let matches = message.embeds[0].description.match(new RegExp(USER_ID_REGSTR, "g"));
  matches = [...new Set(matches)];
  return matches;
}
function getCharFooterMatches(message) {
  let matches = message.embeds[0].description.match(new RegExp(CHAR_NAME_REGSTR, "g"));
  return matches;
}

function getMentionChar(userId, handle) {
  return "<@"+userId+">"+ ( handle ? ":"+handle : "");
}
function decomposeMention(mention) {
  let si = mention.indexOf(":");
  return si >= 0 ? {id: mention.slice(2, si-1), handle:mention.slice(si+1)} : {id: mention.slice(2, mention.length-1), handle: ""};
}

function isValidManeverExpr(str) {
  var commentSplit = str.split("#");
  var comments = "";
  if (commentSplit.length >= 2) {
    comments = commentSplit.slice(1).join("#");
  }

  str = commentSplit[0];
  var spl = str.split(":");
  var handle = "";
  var sh;
  if (spl[0].trim() === "") {
    spl.shift();
    sh = spl[0].indexOf(" ");
    handle = spl[0].slice(0, sh);
    spl[0] = spl[0].slice(sh+1);
    gotHandle = true;
  }
  var error = 0;
  var roll = spl.length >= 2 ? spl.pop() : "";
  if (roll) {
    var diceRollResult = tryRoll(roll);
    if (!diceRollResult || diceRollResult.errors.length) {
      roll = "";
      error |= ERROR_DICE;
    }
  }
  return { roll, str:spl[spl.length - 1], handle, comments, error};
}

async function isValidManeverRpExpr(str, channel) {
  var si = str.indexOf(" ");
  if (si < 0) return "";
   var spl = str.slice(0, si);
   var val = parseInt(spl);
   if (isNaN(val)) {
     return {error:ERROR_SLOT};
   } else {
     let m = await Manuever.findOne({channel_id: channel.id, slot:val});
     if (!m) return {error:ERROR_SLOT};
     let obj = isValidManeverExpr(str.slice(si+1));
     if (obj) {
      obj.m = m;
      obj.r = await Manuever.countDocuments({channel_id: channel.id, replyTo:m.slot});
     } 
     return obj;
   }
}

async function getManueverObj(rem, react, channel, mention) {
  //replyTo
  var obj =  {
    channel_id: channel.id,
    mention: mention,
    slot: !rem.replyManuever ? 0 : rem.replyManuever.slot + "." + (rem.r + 1), // TO properly set this based on rp
    label: rem.str,
    roll: rem.roll,
    comment: rem.comments,
    react: react
  };
  
  if (rem.replyManuever) {  // determine the replyTo objectId
    obj.replyTo = rem.replyManuever.slot;
  }

  if (rem.charState) {
    obj.characterState = rem.charState._id;
  }
  return obj;
}

async function checkAndReactMessage(message, footerTurnMessage) {
  let chk = await isValidManueverMsg(message.content, message.channel);
  if (message.reactions.size) await message.clearReactions();
  if (chk && !chk.error) {
    
    let checkOk = true;
    if (footerTurnMessage !== undefined) {
      if (!footerTurnMessage) {
        let f = await Fecht.findOne({channel_id: message.channel.id}, "latest_footer_id");
        if (f) {
          fid = f.latest_footer_id;
        } else {
          console.log("Could not find fecht issue")
          return;
        }
        footerTurnMessage = await message.channel.fetchMessage(f.latest_footer_id);
      } 

      let matches = getCharFooterMatches(footerTurnMessage);
      let userCharHash = getUserCharHash(matches);
      let mention = getMentionChar(message.author.id, chk.handle );
      checkOk = userCharHash.hash[mention] || userCharHash.defaulting["<@"+message.author.id+">"] != null;
      chk.error |= ERROR_HANDLE;
    }
    
    if (checkOk) {
      await message.react(SYMBOLS.moveOkay);
      if (chk.roll) {
        message.react(SYMBOLS.dice);
      }
      return;
    }
  } 

  if (chk && chk.error) {
    if (chk.error & ERROR_DICE) {
      await message.react(SYMBOLS.x);
    } else if (chk.error & ERROR_SLOT) {
      await message.react(SYMBOLS.exclaim);
    } else if (chk.error & ERROR_HANDLE) {
      await message.react(SYMBOLS.question);
    } else {
      await message.react(SYMBOLS.question);
    }
  } else {
    await message.react(SYMBOLS.x);
  }

}

function getUserCharHash(matches) {
  var i = matches.length;
  var hash = {};
  var defaulting = {};
  var str;
  var user;
  var handle;
  while(--i > -1) {
    str = matches[i];
    hash[str] = true;
    str = str.split(":");
    user = str[0];
    if (defaulting[user] === null) continue;
    //user = user.trim();
    handle = str[1] || "";
    //handle = handle.trim();
    if ( !!defaulting[user] && handle !== "") {
      defaulting[user] = null;
      continue;
    }
    
    if (defaulting[user] === "" && handle !== "") {
      defaulting[user] = null;
      continue;
    }
    
    if (defaulting[user]=== undefined || handle === "") {
      defaulting[user] = handle;
    }
    
  }
  return {hash, defaulting};
}

async function endTurn(channel, phase, footerMessage, fecht) {

  footerMessage.clearReactions();
  let matches = getCharFooterMatches(footerMessage);
  let userCharHash = getUserCharHash(matches);
  await footerMessage.edit(new Discord.RichEmbed({title:TITLES.turnEnded, description: DESCS.pleaseWait,  color:COLOR_BOT}));
  
  // todo: convert this to manuevers
  let allReacts = await DMReact.find({channel_id:channel.id}).catch(errHandler);
  let i;
  let spl;
  let a;
  let len = allReacts.length;
  let rem;
  let man;
  let mention;
  let mentionHashArr = {};

  for (i=0; i< len; i++) {
    a = allReacts[i];
    if (!a.result) continue;
    if ((rem = await isValidManueverMsg(a.result, channel)))  { // && !rem.error
      mention = getMentionChar(a.user_id, a.handle);
      if (!mentionHashArr[mention]) mentionHashArr[mention] = [];
      man = await getManueverObj(rem, true, channel, mention, null);
      mentionHashArr[mention].push(man);
    }
  }
  await DMReact.deleteMany({channel_id:channel.id}).catch(errHandler);

  let fullyCleanedUp = await cleanupChannel(channel, footerMessage.id, null, async (m)=>{
    let rem = await isValidManueverMsg(m.content, channel);
    if (!rem || rem.error) return;
    let mention = getMentionChar(m.author.id, rem.handle);
    if (!userCharHash.hash[mention]) {
      if (userCharHash.defaulting["<@"+m.author.id+">"] != null) {  // non strict not equal is deliberate to also take into account undefined
        rem.handle = userCharHash.defaulting["<@"+m.author.id+">"];
        mention = getMentionChar(m.author.id, rem.handle);
      } else {
        return;
      }
    }
   
    if (!mentionHashArr[mention]) mentionHashArr[mention] = [];
    let man = await getManueverObj(rem, true, channel, mention, null);
    mentionHashArr[mention].push(man);
  }, true, (m)=> {
   
    return m.author.id !== client.user.id || !(m.content.startsWith("|<@") || (m.author.id === client.user.id && m.embeds && m.embeds[0] && m.embeds[0].author && !m.embeds[0].author.name.startsWith(OUTGAME_PREFIX) ));
  });

  

  let collectArr = [];
  let slotCount = await Manuever.countDocuments({channel_id:channel.id, replyTo:0});
  len = matches.length;
  for (i=0; i< len; i++) {
    a = mentionHashArr[matches[i]];
    if (!a) {
      continue;
    }
    a.forEach((obj)=> {
      if (!obj.replyTo) obj.slot = ++slotCount;
      collectArr.push(obj);
    })
  }

  if (collectArr.length) {
    await Manuever.insertMany(collectArr).catch(errHandler);  
  }


  let bd = await channel.fetchMessage(fecht.latest_body_id).catch(errHandler);
  if (bd) {
    let bdm = await getBodyRenderOfFecht(fecht, channel);
    bd.edit(bdm);
  }

  /// `!turn >`
  let newFooterContents;
  if (collectArr.length || slotCount) {
    newFooterContents = new Discord.RichEmbed({ color:COLOR_BOT, title:TITLES.turnEnded, description: "GM may: `!res` / `!res all` / "+getTurnOptions()+" / `!p >`"});
  } else {
    newFooterContents = new Discord.RichEmbed({ color:COLOR_BOT, title:TITLES.resolution, description: getCarryOnMsg()});
  }
  
  if (fullyCleanedUp) footerMessage.edit(newFooterContents);
  else {
    let fm = await channel.send(newFooterContents);
    await Fecht.updateOne({_id:fecht._id}, {latest_footer_id:fm.id});
    await footerMessage.delete();
  }
}

function getCurrentPhase(f) {
  return f.phases ? f.phases[f.phaseCount ? f.phaseCount - 1 : 0] || {} : {};
}

async function cleanupFooter(fid, channel) {
  if (!fid) {
    let f = await Fecht.findOne({channel_id: channelId}, "latest_footer_id");
    if (f) {
      fid = f.latest_footer_id;
    } else {
      return;
    }
  }
      
  let m = typeof fid === "string" ?  await channel.fetchMessage(fid) : fid;
  if (m) {
    m.clearReactions();
  }
}

async function isValidManueverMsg(str, channel) {
  return str.startsWith("!r ") ? isValidManeverExpr(str.slice(3)) : 
  str.startsWith("!rp ") ? await isValidManeverRpExpr(str.slice(4), channel) 
  : "";
}

function getHeaderRenderOfFecht(f) {
  var phasesVal;
  if (!f || !f.phases || f.phases.length === 0) {
    phasesVal = "---";
  } else {
    phasesVal = f.phases.map((f, i)=> { 
      return "*"+(i+1)+".* "+(f.name ? f.name : "Phase "+(i+1));
    }).join("\n");
  }

   return new Discord.RichEmbed({ 
    "title": "=== A New Fecht has Begun! ===",
    "color": COLOR_GAMESTART,
    "fields": [
      {
        "name": "Phases",
        "value": phasesVal
      }
    ]
  });
}



// currently limited to 25 fields.

async function getBodyRenderOfFecht(f, channel) { 
 var embed = new Discord.RichEmbed();
 var i;
 var len;
 var manuevers = await Manuever.find({channel_id: channel.id});
 var phase = getCurrentPhase(f);
 var phaseName = f.phaseCount >= 1 ? phase.name || ("Phase " + f.phaseCount)  : "";

 embed.title = `(${f.roundCount+1}.${f.phaseCount}:${f.initStep}` + (f.miscTurnCount ? "."+f.miscTurnCount : "") + ') ' + phaseName;
 embed.color = COLOR_MAIN;
 var gmLabel = f.gamemaster_id && channel.members.get(f.gamemaster_id) ? "<@"+f.gamemaster_id+">" : "-"; 
 embed.description = GM_PREFIX+" "+gmLabel;
 
 var fieldCount = 0;
 len = f.sides.length;
 for (i =0; i< len; i++) {
  if (fieldCount >= 25) return;
  embed.addField(f.sides[i], "- \n*empty*\n -", true);
  fieldCount++;
 }

 let strikeThru;
 let m;
 len = manuevers.length;
 manuevers.sort(getSortingFunctionOf(phase.resolveSort, SORT_MANUEVERS));

 for (i=0; i< len; i++) {
  if (fieldCount >= 25) return;
  m = manuevers[i]; 
  strikeThru = m.canceled ? "~~" : "";
  embed.addField((strikeThru+"*"+m.slot + ".* " + m.label + (m.roll ? (!strikeThru ? " " + SYMBOLS.dice : ": ")+m.roll : "")) +strikeThru, strikeThru+(m.comment ? m.comment : "")+"\n- " + m.mention+ strikeThru );
  fieldCount++;
 }

 return embed;
}

async function runOnlyIfGotFecht(channel, user, method, projection) {

   if (channel.type === "dm") { // fecht channels are always public, filters out DM cases
    return false;
   }

   if (!projection) projection = "_id";

   var channelId = channel.id;

   if (CHANNELS_FECHT[channelId] !== undefined) {
    if (!CHANNELS_FECHT[channelId]) return false;
    else {
      method();
      return true;
    }
  } else {
    Fecht.findOne({channel_id: channelId}, projection).then((f)=> {
      if (f) {
        CHANNELS_FECHT[channelId] = f._id;
        method(f);
        return true;
      } else {
        CHANNELS_FECHT[channelId] = null;  
        return false;
      }
    });
  }
  return false;
}

async function checkChannelDirtyAny(channel, fid) {
  let c = await channel.fetchMessages({ after:fid, limit:1 });
  return !!c.size;
}

async function checkChannelDirty(channel, fid, condition, limit) {
  let last = fid;
  while( true) {
    let c = await channel.fetchMessages({ after:last, limit});
    if (!c || !c.size) {
      break;
    }
    if (c.find(condition)) {
      return true;
    }
    last = c.first().id;
  }
  return false;
}

async function cleanupChannel(channel, fid, condition, method, alwaysDelete, alwaysDeleteCondition) {
  let last = fid;
  let d;
  let fullyCleanedUp = true;
  while( true) {
    let c = await channel.fetchMessages({ after:last });
    if (!c || !c.size) {
      break;
    }
    last = c.first().id;
    d = c;
    if (condition) c = c.filter(condition);
    if (!c.size) continue;
    if (method) {
      c.tap(method);
    } else if (!alwaysDelete) {
      await Promise.all(c.deleteAll()).catch(emptyHandler);
    }
    if (alwaysDelete) {
      if (alwaysDeleteCondition) {
        let count = d.size;
        d = d.filter(alwaysDeleteCondition);
        if (count !== d.size) fullyCleanedUp = false; 
      }
      await Promise.all(d.deleteAll()).catch(emptyHandler);
    }
 }
 return fullyCleanedUp;
}


client.on('raw', async packet => {

  // We don't want this to run on unrelated packets
  if (!FORWARDED_PACKETS.includes(packet.t)) return;

  if (client.user.id === packet.d.user_id) {
    return;
  }

  let messageId = packet.t === "MESSAGE_UPDATE" ? packet.d.id : packet.d.message_id;

  // Grab the channel to check the message from
  let channel = client.channels.get(packet.d.channel_id);
  let succeeded = true; // did it manage to retrieve channel in initial cache?
  if (!channel) {
    succeeded = false;
    let u = await User.findOne({user_id:packet.d.user_id});
     if (u) {
       channel = client.channels.get(u.channel_id);
       if (!channel) {
        console.log("Failed to find fecht by user id:"+packet.d.user_id+"...DM channel");
        return false;
       }
     } else {
       console.log("Failed to find fecht...DM channel");
       return false;
     }
  }
  
  if (!succeeded || channel.type === "dm") { // need to emulate private DM message handling instead
    if (packet.t === "MESSAGE_REACTION_ADD") {  
      let u = await DMReact.findOne({user_id:packet.d.user_id, message_id:messageId});
      let userR = client.users.get(packet.d.user_id);
        if (u) {
          if (u.result) {
            if (userR) sendTempMessageDM("You've already reacted! Can't re-submit!", userR);
            return;
          } else {
            let f = await Fecht.findOne({channel_id: u.channel_id}, "phases phaseCount latest_footer_id latest_body_id sides roundCount initStep miscTurnCount gamemaster_id");
            if (!f) {
              sendTempMessageDM("The reaction is expired! Can't find fecht channel!", userR);
              return;
            }
            let phase = f.phases[f.phaseCount > 0 ? f.phaseCount - 1 : 0];
            let symbol = packet.d.emoji.name;
            let reactId = phase.dmReacts.indexOf(symbol);
            if (reactId < 0) {
              console.log("!succeeded: Failed to get react Idx");
              return;
            }
            let dmNotify =  phase.dmReacts && phase.dmReacts[reactId] ? phase.dmReactsM[reactId] : "reacted.";
            let namer =  u.content.match(new RegExp(CHAR_NAME_REGSTR, "g"))[0];
            let charHandle = namer.split(":")[1];
            if (!charHandle) charHandle = "";
            else charHandle = ": "+charHandle;
            
            await DMReact.updateOne({user_id:userR.id, message_id:messageId}, {
              result: dmNotify
            });  
            userR.send(namer + " " + dmNotify + "\n(fecht: *"+u.channel_id+"*) <#"+u.channel_id+"> "+ "<--");

            if (phase.reactOnly) {
              let channelDem = client.channels.get(u.channel_id);
              let ftMsg = await channelDem.fetchMessage(f.latest_footer_id);
              if (!ftMsg) {
                console.log("Could not find footer msg");
                return;
              }
              let matches = getCharFooterMatches(ftMsg);
              if (matches.length === await DMReact.countDocuments({channel_id: u.channel_id, result:{$ne: ""}})) {
                if (phase.reactOnly === 2) { // check footer if turn condition is met first
  
                }
                endTurn(channelDem, phase, ftMsg, f);
                return;
              }
            }
  
          }
        } else {
          sendTempMessageDM("This reaction can no longer be processed. (expired?)", userR);
          return;
        }
        

      }
    return;
  }
 
  // There's no need to emit if the message is cached, because the event will fire anyway for that
  if (channel.messages.has(messageId)) return;

  
  
  // check channel fecht availability
  ///*
  if (CHANNELS_FECHT[channel.id] !== undefined) {
    if (!CHANNELS_FECHT[channel.id]) return;
  } else {
    let f = await Fecht.findOne({channel_id: channel.id}, "_id");
    if (f) {
      CHANNELS_FECHT[channel.id] = f._id;
    } else {
      CHANNELS_FECHT[channel.id] = null;  
      return;
    }
  }
  //*/
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

/*
client.on("messageReactionRemove", (messageReaction, user) => {
  if (user.bot) {
    return;
  }
  console.log("C");

});
*/

client.on("messageReactionAdd", async (messageReaction, user) => {
  if (user.bot) {
    return;
  }
  
  // dev: to output emojis for tracing
 //messageReaction.message.channel.send( "\\"+messageReaction.emoji.toString() );

  runOnlyIfGotFecht(messageReaction.message.channel, user, async ()=> {

    if (messageReaction.users.size < 2) {
      messageReaction.users = await messageReaction.fetchUsers();
    }

    let channel = messageReaction.message.channel;
    if (!messageReaction.message.content.startsWith("!") && messageReaction.emoji.name === SYMBOLS.x) {;
      let f = await Fecht.findOne({channel_id: channel.id}, "gamemaster_id");
      if (user.id === f.gamemaster_id && !isBotEmbed(messageReaction.message) ) {
        messageReaction.message.delete().catch(emptyHandler);
        return;
      }
    }

    if (!messageReaction.users.has(client.user.id)) { //|| 
      messageReaction.remove(user);
      // user.send("Please do not add unauthorised reactions to messages while a fecht is in progress!");
      return;
    }


    if (messageReaction.message.author.id !== client.user.id ) { //|| !messageReaction.users.has(client.user.id)
     // user.send("Please do not add unauthorised reactions to messages while a fecht is in progress!")
      if (messageReaction.message.author.id === user.id) { // Or gamemaster user_id...
        if (messageReaction.emoji.name === SYMBOLS.dice) {
          messageReaction.remove(user);
          let f = await Fecht.findOne({channel_id: channel.id}, "latest_footer_id");
          let footerMessage = await channel.fetchMessage(f.latest_footer_id);
          await rollMessage(messageReaction.message, getUserCharHash(getCharFooterMatches(footerMessage)));
          messageReaction.message.delete();
          return;
        } else if (messageReaction.emoji.name === SYMBOLS.moveOkay) {
          return;
        }
      }
      messageReaction.remove(user);
      return;
    }
    
    if (messageReaction.message.embeds[0] && messageReaction.message.embeds[0].title === TITLES.turnFor) {
      let matches = getUserFooterMatches(messageReaction.message);
      let f = await Fecht.findOne({channel_id: channel.id}, "phases phaseCount latest_body_id sides roundCount initStep miscTurnCount gamemaster_id");
      let phase = f.phases[f.phaseCount > 0 ? f.phaseCount - 1 : 0];
      if (!phase) phase = {};
      if (matches.includes("<@"+user.id+">")) {
        let mru = messageReaction.users.filter(u=>matches.includes("<@"+u.id+">"));
        if (mru.size === matches.length) {
          endTurn(channel, phase, messageReaction.message, f);
          return;
        }
       
      } else {
        messageReaction.remove(user);
      }
    } else if (messageReaction.emoji.name === SYMBOLS.play) {
      await rollResolvableMsg(messageReaction.message);
      await Manuever.deleteOne({message_id: messageReaction.message.id});
      await messageReaction.message.delete();
    } else {  // (currently assumed reaction turn atm)
      if (messageReaction.message.mentions.users.get(user.id)) {

        let channel = messageReaction.message.channel;  
        let symbol = messageReaction.emoji.name;
        let member = messageReaction.message.mentions.members.first(); 
        
        let message = await messageReaction.message.clearReactions();
        
        let f = await Fecht.findOne({channel_id: channel.id}, "latest_footer_id latest_body_id sides phases phaseCount roundCount initStep miscTurnCount");
        let phase = f.phases[f.phaseCount > 0 ? f.phaseCount - 1 : 0];
        if (!phase) phase = {};
        if (!phase.reacts || !phase.reacts.length) return;
        
        let reactId = phase.reacts.indexOf(symbol);
        if (reactId < 0) {
          console.log("Failed to get react Idx");
          return;
        }
        let dmNotify =  phase.reactsM && phase.reactsM[reactId] ? phase.reactsM[reactId] : (" requested DM.");
        let namer =  message.content.match(new RegExp(CHAR_NAME_REGSTR, "g"))[0];
        let charHandle = namer.split(":")[1];
        if (!charHandle) charHandle = "";

        /*
        message.edit(new Discord.RichEmbed({
          "description": dmNotify, //remainingContents[remainingContents.length-1]
          "author": {
            "name": member.displayName+charHandle, // + (remainingContents.length > 1 ? remainingContents[0] : ""),
            "icon_url": user.displayAvatarURL
          }
        }));
        */

        //message.edit(namer + " " + dmNotify);  
        message.edit(namer + " " + dmNotify );
       
        if (phase.dmReacts && phase.dmReacts.length) {  // DMReacts from player required
          await User.updateOne({user_id:user.id}, {
            channel_id: channel.id,
            user_id: user.id
          }, {upsert: true, setDefaultsOnInsert: true});
         
        
          let m2 = await user.send(namer + (phase.dmReactsD ? " "+phase.dmReactsD : " reacts with:") + "\n(fecht: *"+channel.id+"*)");
         
          await DMReact.create({
            channel_id: channel.id,
            user_id: user.id,
            handle: charHandle,
            message_id: m2.id,
            result: "",
            content: m2.content
          });

          let k;
        
          for (k=0; k < phase.dmReacts.length; k++) {
            if (phase.dmReacts[k] !== symbol) {
              await m2.react(phase.dmReacts[k]).catch(errHandler);
            }
          }
          
        } else {  // no DMReacts from player required
          await User.updateOne({user_id:user.id}, {
            channel_id: channel.id,
            user_id: user.id
          }, {upsert: true, setDefaultsOnInsert: true});

          await DMReact.create({  // create dummy DMReact with dummy - results/contents
            channel_id: channel.id,
            user_id: user.id,
            handle: charHandle,
            message_id: "-",
            result: phase.reactsM && phase.reactsM[reactId] ? phase.reactsM[reactId] : "-",
            content: "-"
          });

          if (phase.reactOnly) {
            let ftMsg = await channel.fetchMessage(f.latest_footer_id);
           
            if (!ftMsg) {
              console.log("Could not find footer msg");
              return;
            }
            let matches = getCharFooterMatches(ftMsg);
            if (matches.length === await DMReact.countDocuments({channel_id:channel.id})) {
              if (phase.reactOnly === 2) { // check footer if turn condition is met first

              }
              endTurn(channel, phase, ftMsg, f);
              return;
            }
          }
        }
      } else {
        messageReaction.remove(user);
      }
    }
  });

});

client.on("messageUpdate", async (oldMessage, message) => { // oldMessage might be null for uncached messages
   // console.log(message.content);
   if (message.content.startsWith("!r ") || message.content.startsWith("!rp ")) {
     await checkAndReactMessage(message, null);
    }
});

client.on("message", async (message) => {
  if (message.author.bot) {
    return;
  }
  if (message.content.startsWith(PREFIX)) {
    var contentIndex = message.content.indexOf(" ");
    var command = contentIndex >= 0 ? message.content.slice(1, contentIndex) : message.content.slice(1);
    var remainingContents = contentIndex>=0 ? message.content.slice(contentIndex+1) : null;
    if (remainingContents) remainingContents = remainingContents.trim();
    var channel = message.channel;

    // Fecht start and ending commands
    if (command === "fechtstart" || command === "fechtend") {
      if (channel.type === "dm") {
        sendTempMessage("Not here dude...this is a DM channel..", channel)
        return;
      }
      if (command === "fechtstart") {  
        Fecht.findOne({channel_id: channel.id}, "_id").then((f)=> {
          if (f) {
           
            if (CHANNELS_FECHT[channel.id] === undefined) CHANNELS_FECHT[channel.id] = f._id;
            sendTempMessage("Fecht is already in progress for this channel...", channel);

          
          } else {
          channel.send(getHeaderRenderOfFecht()).then((m1)=> {
            channel.send(new Discord.RichEmbed({ color:COLOR_MAIN, description:"..."})).then((m2)=> {
              channel.send(new Discord.RichEmbed({color:COLOR_BOT, description:"Preparing fecht...Please wait.."})).then((m3)=> {
                var fecht = new Fecht();
                Fecht.create({
                  channel_id: channel.id,
                  pin_header_id: m1.id,
                  latest_footer_id: m3.id,
                  latest_body_id: m2.id,
                  gamemaster_id: message.author.id,
                  json: '{}',
                  sides: ['Side A', 'Side B'],
                }, (err, f)=> {
                  if (err) return;
                  CHANNELS_FECHT[channel.id] = f._id;
                  m3.edit(new Discord.RichEmbed({description:"Fecht has begun!",  color:COLOR_BOT}));
                  getBodyRenderOfFecht(f, channel).then((bdm)=> {
                    m2.edit(bdm);
                  }).catch(errHandler);
                 
                  //m1.pin();

                });
              })
            });
            });
          }
          
        });
      } else {  // fetchend
        let f = await Fecht.findOne({channel_id: channel.id}, "latest_footer_id latest_body_id sides");
        if (f) {
          let fid = f.latest_footer_id;
          await f.delete().catch(errHandler);
          await User.deleteMany({channel_id:channel.id}).catch(errHandler);
          await DMReact.deleteMany({channel_id:channel.id}).catch(errHandler);
          await Manuever.deleteMany({channel_id:channel.id}).catch(errHandler);
          
          await channel.send(new Discord.RichEmbed({color:COLOR_GAMEOVER, description:"-- FECHT OVER! We have ended! --"}));
          CHANNELS_FECHT[f._id] = null;
          await cleanupFooter(fid, channel);
          await cleanupChannel(channel, fid, m=>m.author.id === client.user.id && m.reactions.size);
          return;
        } else {
          sendTempMessage("There is no fecht currently in progress.", channel);
        }
        
        /*
        Fecht.deleteOne({channel_id: channel.id}).then((s)=> {
          if (s && s.deletedCount > 0) {
            CHANNELS_FECHT[channel.id] = null;
            channel.send(new Discord.RichEmbed({color:COLOR_GAMEOVER, description:"-- FECHT OVER! We have ended! --"}));
          } else sendTempMessage("There is no fecht currently in progress.", channel);
        });
        */
      }
      message.delete();
      return;
    }



    if (channel.type === "dm") {
      sendTempMessage("Not here dude...this is a DM channel..", channel);
      return;
    }


    if (CHANNELS_FECHT[channel.id] !== undefined) {
      if (!CHANNELS_FECHT[channel.id]) return;
    } else {
      let f = await Fecht.findOne({channel_id: channel.id}, "_id");
      if (!f) {
        if (FECHT_COMMANDS[command]) {
          sendTempMessage("No fecht currently in progress. Use `!fechtstart` to begin", channel);
          message.delete();
        } 
        return;
      }
    }

    let f;
    let m;
    let phase;

    // Fecht only commands
    switch(command) {
      case 'phases':
      case 'phase': // test single phase setting
        if (!remainingContents) {
          sendTempMessage("Specify Phase JSON to test..", channel);
          break;
        }
        try {
          var parsedJSON = JSON.parse(remainingContents);
        }
        catch( err) {
           sendTempMessage("Failed to parse Phase JSON for test", channel);
           break;
        }
        Fecht.findOneAndUpdate({channel_id: channel.id}, {phaseCount:1, phases:Array.isArray(parsedJSON) ? parsedJSON : [parsedJSON]}, {new:true}).then((f)=> {
          if (f) {
           channel.fetchMessage(f.pin_header_id).then((m)=> { 
             m.edit(getHeaderRenderOfFecht(f)) 
             channel.fetchMessage(f.latest_body_id).then((m)=> { 
              getBodyRenderOfFecht(f, channel).then((bdm)=>{m.edit(bdm)});
             });
          });
          } else {
            console.log("Failed to update phases for fecht");
          } 
        });
      break;
      case 'skipturnall':
      case 'endturnall':
        f = await Fecht.findOne({channel_id:channel.id}, "latest_footer_id gamemaster_id latest_body_id sides phases phaseCount roundCount initStep miscTurnCount");
        m = await channel.fetchMessage(f.latest_footer_id);
        if (m.embeds[0].title !== TITLES.turnFor) {
          sendTempMessage("Turn has already ended...", channel);
          break;
        }
        if (f) {
          endTurn(channel, getCurrentPhase(f), m, f);
          break;
        }
      break;
      case 'say':
      f = await Fecht.findOne({channel_id:channel.id}, "latest_footer_id gamemaster_id");
      m = await channel.fetchMessage(f.latest_footer_id);
      

      let isGm = m.embeds[0].title !== TITLES.turnFor && message.author.id === f.gamemaster_id;
      let isOutgame = false;

      if (f.gamemaster_id !== message.author.id) {
        if (m.embeds[0].title !== TITLES.turnFor) {
          let matches = getUserFooterMatches(m);
          if (!matches.includes("<@"+message.member.user.id+">")) {
            sendTempMessage("<@"+message.member.user.id+"> It's not your turn yet to use permanent `!say`. Use `!s` instead for temporary chat.", channel);
            message.delete();
            return;
          }
          
        } else if (m.embeds[0].title === TITLES.resolution) {
          sendTempMessage("<@"+message.author.id+"> Non GMs can only use `!s`", channel);
          message.delete();
          return;
          
        } else {
          message.delete();
          return;
        }
       } else {
        if (m.embeds[0].title === TITLES.turnFor) {
          let matches = getUserFooterMatches(m);
          if (!matches.includes("<@"+message.member.user.id+">")) {
            isGm = false;
            isOutgame = true;
          }
          
        }
       }
        
       channel.send(new Discord.RichEmbed({
          "description": getInlineRolls(remainingContents), //remainingContents[remainingContents.length-1]
          "color": isGm ? COLOR_GM : undefined,
          "author": {
            "name": (isGm ? GM_PREFIX : "") + (isGm ? "" : (isOutgame ? OUTGAME_PREFIX : "")+message.member.displayName), // + (remainingContents.length > 1 ? remainingContents[0] : ""),
            "icon_url": message.author.displayAvatarURL
          }
        }));
      break;
      case 's':
        channel.send(new Discord.RichEmbed({
          "description": getInlineRolls(remainingContents), //remainingContents[remainingContents.length-1]
          "color": COLOR_OUT_OF_GAME,
          "author": {
            "name": OUTGAME_PREFIX+message.member.displayName, // + (remainingContents.length > 1 ? remainingContents[0] : ""),
            "icon_url": message.author.displayAvatarURL
          }
        }));
      break;
      case 'res':
        message.delete();

        f = await Fecht.findOne({channel_id:channel.id}, "latest_footer_id gamemaster_id phases phaseCount");
        m = await channel.fetchMessage(f.latest_footer_id);
        if (m.embeds[0].title !== TITLES.turnEnded) {
          //sendTempMessage("Resolution no longer available!", channel);
          return;
        }

        await m.edit(new Discord.RichEmbed({ color:COLOR_BOT, title:(remainingContents === "all" ? TITLES.resolvingPlays : TITLES.settingUpResolvePlays), description: DESCS.pleaseWait}));
        phase = getCurrentPhase(f);
        let manuevers = await Manuever.find({channel_id:channel.id});
        manuevers.sort(getSortingFunctionOf(phase.resolveSort, SORT_MANUEVERS));
        let i;
        let len = manuevers.length;


        if (remainingContents === "all") {
          for (i=0; i<len; i++) {
            await rollManuever(manuevers[i], channel);
          }
          await Manuever.deleteMany({channel_id:channel.id});
          ;
        } else {
          manuevers.reverse();
            for (i=0; i<len; i++) {
              for (i=0; i<len; i++) {
                let man = manuevers[i];
                let msg = await channel.send("!e "+man.slot + ". " + man.label + (man.roll ? " "+":"+" "+man.roll : "") + (man.comment ? " # "+man.comment : "") + RESOLVE_MENTION_SPLIT+man.mention);
                // assige message_id to Manuever for saving?
                await Manuever.updateOne({_id:man._id}, {message_id:msg.id});
                if (msg) await msg.react(SYMBOLS.play);
              }
            }
        }
        await channel.send(remainingContents === "all" ? "All actions rolled!" : "..ready to resolve plays!")
        await m.edit(new Discord.RichEmbed({ color:COLOR_BOT, title:TITLES.resolution, description: (remainingContents === "all" ? "" : "GM may: "+SYMBOLS.play+"or `!e` actions!\n")+getCarryOnMsg() }));
       
      return;
      case 'r':
      case 'rp':
        f = await Fecht.findOne({channel_id:channel.id}, "latest_footer_id gamemaster_id phases");
        m = await channel.fetchMessage(f.latest_footer_id);
        if (m.embeds[0].title !== TITLES.turnFor) {
          sendTempMessage("There is no turn in progress..", channel);
          message.delete();
          return;
        }
        let matches = getUserFooterMatches(m);
        if (!matches.includes("<@"+message.member.user.id+">")) {
          sendTempMessage("<@"+message.member.user.id+"> It's not your turn yet..", channel);
          message.delete();
          return;
        }
        phase = getCurrentPhase(f);
        if (phase.reactOnly === 1) {
          sendTempMessage("<@"+message.member.user.id+"> Typed manuevers not allowed in this phase", channel);
          message.delete();
          return;
        }

        await checkAndReactMessage(message, m);
      return;
      case 'turn': // test single turn for phase atm
        if (message.mentions.users.size) {
          let arr = message.mentions.users.array();
          let i;
          let len = arr.length;
          for (i=0; i<len; i++) {
            if (arr[i].bot) {
              message.delete(); 
              sendTempMessage("Currently, bots can't take part in a turn!", channel);
              return;
            }
          }
          remainingContents = remainingContents.replace("\t", " ");
          
          let abc = getCharNameRegMatches(remainingContents);
          
          len = abc.length; // TODO: check valid characters
          for (i=0; i< len; i++) {
            let spl = abc[i].split(":", 2);
            spl[0] = spl[0].trim();
            if (spl[1]) spl[1].trim();
            abc[i] = spl.join(":");
          }

          let f = await Fecht.findOne({channel_id:channel.id}, "phases latest_footer_id gamemaster_id latest_body_id sides phaseCount roundCount initStep miscTurnCount");

          let m = await channel.fetchMessage(f.latest_footer_id);

          let lastFooterTitle = m.embeds[0].title;
          if (lastFooterTitle === TITLES.turnFor) {
            //await endTurn(channel, getCurrentPhase(f), m);
            sendTempMessage("Please end turn first. GM can force this with `!endturnall`/`!skipturnall`.", channel);
            message.delete();
            return;
          }

          /*  // This can cause hangups, i'd rather not.. atm
          if (m.embeds[0].description === DESCS.pleaseWait) {
            message.delete();
            return;
          }
          */

          let wasResolution = lastFooterTitle === TITLES.resolution;
          ///*
          let isDirty = await checkChannelDirty(channel, f.latest_footer_id, (m)=> {
            return (m.embeds && m.embeds[0]) || (wasResolution && m.author.id === f.gamemaster_id)  || (m.author.id === client.user.id && m.content.startsWith("|<@"));
          });
          //*/

          /* // THis method doesn't seem to work fullproof
          //let isDirty = await checkChannelDirtyAny(channel, f.latest_footer_id);
          //console.log(isDirty);
          */

          if (isDirty) {
            let obj = await updateNewBodyFooter(f, channel, ++f.miscTurnCount);
            f = obj.f;
            await m.delete();
            m = obj.footer;
            
          }

          phase = getCurrentPhase(f);
          let gotTurnTick = phase.reactOnly !== 1;
          await m.edit(new Discord.RichEmbed({ color:COLOR_BOT, title:TITLES.turnFor, description:abc.join(", ") + (gotTurnTick ? "\nPlease respond with the reaction icon below to finalise your turn." : "")}));
          if (gotTurnTick) {
            m.react(SYMBOLS.turnTick);
          }

          if (phase.reacts && phase.reacts.length) {
            if (phase.dmReacts && phase.dmReacts.length) {
              await channel.send(new Discord.RichEmbed({description:"Check (DM) direct messages from me AFTER you've tapped your reaction down below:"}));
            } else {
              await channel.send(new Discord.RichEmbed({description: (phase.reactOnly === 1 ? "Tap your " : "Your ")+"reactions below:"}));
            }
          }

          if (phase && phase.reacts && phase.reacts.length) {
           for (i=0; i<len; i++) {
            let m2 = await channel.send(abc[i] + (phase.reactsD ? " "+phase.reactsD : " reacts with") + ":");
            let k;
            for (k=0; k < phase.reacts.length; k++) {
              await m2.react(phase.reacts[k]);
            }
            
           } 
          }
        } else {
          sendTempMessage("Please mention characters for turn...", channel); 
        }
      break;
      default:

      break;
    }

    message.delete();

  } else {  // plain text message, should clean up?
    var channel = message.channel;
    if (CHANNELS_FECHT[channel.id] !== undefined) {
      if (!CHANNELS_FECHT[channel.id]) return;
      else message.delete();
    } else {
      Fecht.findOne({channel_id: channel.id}, "_id").then((f)=> {
        if (f) {
          message.delete();
          CHANNELS_FECHT[channel.id] = f._id;
        } else {
          CHANNELS_FECHT[channel.id] = null;  
        }
      });
    }

  }
});

client.login(process.env.TOKEN);