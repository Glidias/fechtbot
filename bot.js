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
const {sendTempMessage, sendTempMessageDM} = require('./server/modules/general');

const PREFIX = process.env.PREFIX;
const COLOR_GAMEOVER = 0xdd33ee;

const TITLES = {
  turnFor: ":: Turn for ::",
  turnEnded: ":: Turn ended ::"
};

const delayWait = (msec) => new Promise((resolve) => setTimeout(resolve, msec));

// cache for channel_id to fechtId!
const CHANNELS_FECHT = {};

const FECHT_COMMANDS = {
  "turn": true,
  "say": true,
  "phase": true
};

const FORWARDED_PACKETS = ["MESSAGE_REACTION_ADD", "MESSAGE_REACTION_REMOVE", "MESSAGE_UPDATE"];

const CHAR_NAME_REGSTR = '(<@[0-9]+>(?:[ ]*:[ ]*[^@#,`<> ]+)?)';
const USER_ID_REGSTR = '<@[0-9]+>';

client.on("ready", () => {
  console.log("FechtBot Online!");
});

function errHandler(e) {
  console.log(e);
}

function errCatcher(e) {
  console.log(e);
}

function getUserFooterMatches(message) {
  return message.embeds[0].description.match(new RegExp(USER_ID_REGSTR, "g"));
}

async function endTurn(channel, phase, footerMessage) {
  // todo: convert this to manuevers
  await DMReact.deleteMany({channel_id:channel.id}).catch(errHandler);

  if (phase.reactOnly===2) { // also check for reacts before ending turn
           
  }
  footerMessage.clearReactions();
  footerMessage.edit(new Discord.RichEmbed({title:TITLES.turnEnded, description: "GM may resolve stored manuevers now using `!res`"}));

   cleanupChannel(channel, footerMessage.id);
  
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

function getHeaderRenderOfFecht(f) {
  var phasesVal;
  if (!f || !f.phases || f.phases.length === 0) {
    phasesVal = "---";
  } else {
    phasesVal = f.phases.map((f, i)=> { 
      return (i+1)+". "+(f.name ? f.name : "Phase "+(i+1));
    }).join("\n");
  }

   return new Discord.RichEmbed({ 
    "title": "=== A New Fecht has Begun! ===",
    "fields": [
      {
        "name": "Phases",
        "value": phasesVal
      }
    ]
  });
}




function getBodyRenderOfFecht(f) {
 var embed = new Discord.RichEmbed();
 var i;
 var len;

 len = f.sides.length;
 for (i =0; i< len; i++) {
  embed.addField(f.sides[i], "..", true);
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

async function cleanupChannel(channel, fid, condition, method) {
  let last = fid;
  while( true) {
    let c = await channel.fetchMessages({ after:last });
    if (!c || !c.size) break;

    last = c.last().id;

    if (condition) c = c.filter(condition);
    if (!c.size) continue;
    if (method) {
      c.tap(method);
    } else {
      try {
        c.deleteAll();
      } catch(err) {
        console.log("PROBLEM with deleteAll");
        console.log(err);
      }
    }
 }
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
            let f = await Fecht.findOne({channel_id: u.channel_id}, "phases phaseCount latest_footer_id");
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
              let matches = getUserFooterMatches(ftMsg);
              if (matches.length === await DMReact.countDocuments({result:{$ne: ""}})) {
                if (phase.reactOnly === 2) { // check footer if turn condition is met first
  
                }
                endTurn(channelDem, phase, ftMsg);
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
  
  // to output emojis for tracing
  //messageReaction.message.channel.send( "\\"+messageReaction.emoji.toString() );
  runOnlyIfGotFecht(messageReaction.message.channel, user, async ()=> {

    if (messageReaction.message.author.id !== client.user.id ) { //|| !messageReaction.users.has(client.user.id)
      messageReaction.remove(user);
      user.send("Please do not add unauthorised reactions to messages while a fecht is in progress!")
      return;
    }

    if (messageReaction.users.size < 2) {
      messageReaction.users = await messageReaction.fetchUsers();
    }

    if (!messageReaction.users.has(client.user.id)) { //|| 
      messageReaction.remove(user);
      user.send("Please do not add unauthorised reactions to messages while a fecht is in progress!");
      return;
    }

    let channel = messageReaction.message.channel;
    
    if (messageReaction.message.embeds[0] && messageReaction.message.embeds[0].title === TITLES.turnFor) {
      let matches = getUserFooterMatches(messageReaction.message);
      let f = await Fecht.findOne({channel_id: channel.id}, "phases phaseCount");
      let phase = f.phases[f.phaseCount > 0 ? f.phaseCount - 1 : 0];
      if (!phase) phase = {};
      if (matches.includes("<@"+user.id+">")) {
        let mru = messageReaction.users.filter(u=>matches.includes("<@"+u.id+">"));
        if (mru.size === matches.length) {
          endTurn(channel, phase, messageReaction.message);
        }
       
      } else {
        messageReaction.remove(user);
      }
    } else {  // (currently assumed reaction turn atm)
      if (messageReaction.message.mentions.users.get(user.id)) {

        let channel = messageReaction.message.channel;  
        let symbol = messageReaction.emoji.name;
        let member = messageReaction.message.mentions.members.first(); 
        
        let message = await messageReaction.message.clearReactions();
        
        let f = await Fecht.findOne({channel_id: channel.id}, "latest_footer_id phases phaseCount");
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
        else charHandle = ": "+charHandle;

        /* // member display only works in Non direct message..
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
       
        if (phase.dmReacts && phase.dmReacts.length) {
          await User.updateOne({user_id:user.id}, {
            channel_id: channel.id,
            user_id: user.id
          }, {upsert: true, setDefaultsOnInsert: true});
         
        
          let m2 = await user.send(namer + (phase.dmReactsD ? " "+phase.dmReactsD : " reacts with:") + "\n(fecht: *"+channel.id+"*)");
         
          await DMReact.create({
            channel_id: channel.id,
            user_id: user.id,
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
          
        } else {
          await User.updateOne({user_id:user.id}, {
            channel_id: channel.id,
            user_id: user.id
          }, {upsert: true, setDefaultsOnInsert: true});

          await DMReact.create({
            channel_id: channel.id,
            user_id: user.id,
            message_id: "-",
            result: "-",
            content: "-"
          });

          if (phase.reactOnly) {
            let ftMsg = await channel.fetchMessage(f.latest_footer_id);
           
            if (!ftMsg) {
              console.log("Could not find footer msg");
              return;
            }
            let matches = getUserFooterMatches(ftMsg);
            if (matches.length === await DMReact.countDocuments()) {
              if (phase.reactOnly === 2) { // check footer if turn condition is met first

              }
              endTurn(channel, phase, ftMsg);
            }
          }
        }
      } else {
        messageReaction.remove(user);
      }
    }
  });

});

client.on("messageUpdate", (oldMessage, message) => { // oldMessage might be null for uncached messages
  // console.log(message.content);
});

client.on("message", async (message) => {

  if (message.author.bot) {
    return;
  }
  if (message.content.startsWith(PREFIX)) {
    var contentIndex = message.content.indexOf(" ");
    var command = contentIndex >= 0 ? message.content.slice(1, contentIndex) : message.content.slice(1);
    var remainingContents = contentIndex>=0 ? message.content.slice(contentIndex+1) : null;
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
            channel.send(new Discord.RichEmbed({description:"..."})).then((m2)=> {
              channel.send(new Discord.RichEmbed({description:"Preparing fecht...Please wait.."})).then((m3)=> {
                var fecht = new Fecht();
                Fecht.create({
                  channel_id: channel.id,
                  pin_header_id: m1.id,
                  latest_footer_id: m3.id,
                  latest_body_id: m2.id,
                  json: '{}',
                  sides: ['Side A', 'Side B'],
                }, (err, f)=> {
                  if (err) return;
                  CHANNELS_FECHT[channel.id] = f._id;
                  m3.edit(new Discord.RichEmbed({description:"Fecht has begun!"}));
                  m2.edit(getBodyRenderOfFecht(f));
                  //m1.pin();

                });
              })
            });
            });
          }
          
        });
      } else {  // fetchend
        let f = await Fecht.findOne({channel_id: channel.id}, "_id latest_footer_id");
        if (f) {
          let fid = f.latest_footer_id;
          await f.delete().catch(errHandler);
          await User.deleteMany({channel_id:channel.id}).catch(errHandler);
          await DMReact.deleteMany({channel_id:channel.id}).catch(errHandler);
          await channel.send(new Discord.RichEmbed({color:COLOR_GAMEOVER, description:"-- FECHT OVER! We have ended! --"}));
          CHANNELS_FECHT[f._id] = null;
          cleanupFooter(fid, channel);
          cleanupChannel(channel, fid, m=>m.author.id === client.user.id && m.reactions.size);
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

    // Fecht only commands
    switch(command) {
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
        Fecht.findOneAndUpdate({channel_id: channel.id}, {phases:[parsedJSON]}, {new:true}).then((f)=> {
          if (f) {
           channel.fetchMessage(f.pin_header_id).then((m)=> { m.edit(getHeaderRenderOfFecht(f)) });
          } else {
            console.log("Failed to update phases for fecht");
          } 
        });
      break;
      case 'say':
        channel.send(new Discord.RichEmbed({
          "description": remainingContents, //remainingContents[remainingContents.length-1]
          "author": {
            "name": message.member.displayName, // + (remainingContents.length > 1 ? remainingContents[0] : ""),
            "icon_url": message.author.displayAvatarURL
          }
        }));
      break;
      case 'r':
      case 'rp':
      return;
      case 'turn': // test single turn for phase atm
        if (message.mentions.users.size) {
          var arr = message.mentions.users.array();
          var i;
          var len = arr.length;
          for (i=0; i<len; i++) {
            if (arr[i].bot) {
              message.delete(); 
              sendTempMessage("Currently, bots can't take part in a turn!", channel);
              return;
            }
          }
          remainingContents = remainingContents.replace("\t", " ");
          let regex = new RegExp(CHAR_NAME_REGSTR, 'g')
          let abc = remainingContents.match(regex);
          len = abc.length; // TODO: check valid characters
          for (i=0; i< len; i++) {
            let spl = abc[i].split(":", 2);
            spl[0] = spl[0].trim();
            if (spl[1]) spl[1].trim();
            abc[i] = spl.join(":");
          }

          let f = await Fecht.findOne({channel_id:channel.id}, "phases latest_footer_id");

          let m = await channel.fetchMessage(f.latest_footer_id);
          let phase = f.phases ? f.phases[0] || {} : {};
          let gotTurnTick = phase.reactOnly !== 1;
          await m.edit(new Discord.RichEmbed({title:TITLES.turnFor, description:abc.join(", ") + (gotTurnTick ? "\nPlease respond with the reaction icon below to finalise your turn." : "")}));
          if (gotTurnTick) {
            m.react("✅");
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