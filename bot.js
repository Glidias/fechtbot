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

  const { Fecht } = require('./server/model/Fecht')
  const {sendTempMessage} = require('./server/modules/general');

  const PREFIX = process.env.PREFIX;
  const COLOR_GAMEOVER = 0xdd33ee;

  const TITLES = {
    turnFor: ":: Turn for ::"
  };
  
  // cache for channel_id to fechtId!
  const CHANNELS_FECHT = {};

  const CHAR_NAME_REGSTR = '(<@[0-9]+>(?:[ ]*:[ ]*[^@#,`<> ]+)?)';

  client.on("ready", () => {
    console.log("FechtBot Online!");
  });

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

  function runOnlyIfGotFecht(channel, method) {
     // check channel 
     if (CHANNELS_FECHT[channel.id] !== undefined) {
      if (!CHANNELS_FECHT[channel.id]) return false;
      else {
        method();
        return true;
      }
    } else {
      Fecht.findOne({channel_id: channel.id}, "_id").then((f)=> {
        if (f) {
          CHANNELS_FECHT[channel.id] = f._id;
          method();
          return true;
        } else {
          CHANNELS_FECHT[channel.id] = null;  
          return false;
        }
      });
    }
    return false;
  }


  client.on('raw', async packet => {
    // We don't want this to run on unrelated packets
    if (!['MESSAGE_REACTION_ADD', 'MESSAGE_REACTION_REMOVE'].includes(packet.t)) return;
    // Grab the channel to check the message from
    const channel = client.channels.get(packet.d.channel_id);
    // There's no need to emit if the message is cached, because the event will fire anyway for that
    if (channel.messages.has(packet.d.message_id)) return;
    
    // check channel
    /*
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
    */
    
    channel.fetchMessage(packet.d.message_id).then(message => {
      // Emojis can have identifiers of name:id format, so we have to account for that case as well
      const emoji = packet.d.emoji.id ? `${packet.d.emoji.name}:${packet.d.emoji.id}` : packet.d.emoji.name;
      // This gives us the reaction we need to emit the event properly, in top of the message object
      const reaction = message.reactions.get(emoji);
      // Adds the currently reacting user to the reaction's users collection.
      if (reaction) reaction.users.set(packet.d.user_id, client.users.get(packet.d.user_id));
      // Check which type of event it is before emitting
      if (packet.t === 'MESSAGE_REACTION_ADD') {
          client.emit('messageReactionAdd', reaction, client.users.get(packet.d.user_id));
      }
      if (packet.t === 'MESSAGE_REACTION_REMOVE') {
          client.emit('messageReactionRemove', reaction, client.users.get(packet.d.user_id));
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
    
    
    runOnlyIfGotFecht(messageReaction.message.channel, async ()=> {
      if (messageReaction.message.author.id !== client.user.id) {
        return;
      }
      
      if (messageReaction.message.embeds[0] && messageReaction.message.embeds[0].title === TITLES.turnFor) {
        var matches = messageReaction.message.embeds[0].description.match(new RegExp(CHAR_NAME_REGSTR, "g"));
      } else {  // currently assumed is react in Public tset,,, subjected to change
        if (messageReaction.message.mentions.users.get(user.id)) {
          let member = messageReaction.message.mentions.members.first();
          let reactId = messageReaction.emoji.identifier;
          reactId = messageReaction.message.reactions.array().findIndex((r)=>{return r.emoji.identifier === reactId});
          if (reactId <0) {
            console.log("Failed to get react index!");
            return;
          }
          let channel = messageReaction.message.channel;
          
          let message = await messageReaction.message.clearReactions();
          
          let f = await Fecht.findOne({channel_id: channel.id}, "phases phaseCount reactsM dmReacts dmReactsD");
         
          if (!f.phases || !f.phases.length) {
            console.log("No phases problem!");
            return;
          }
          let phase = f.phases[f.phaseCount > 0 ? f.phaseCount - 1 : 0];
          //console.log(reactId);
          let dmNotify =  phase.reactsM && phase.reactsM[reactId] ? phase.reactsM[reactId] : " requested DM.";
          /*
          if (phase.dmReacts) {
            dmNotify += (dmNotify ? "\n" : "") + "Please check your direct messages from me for"+ (false ? ": "+ phase.dmReactsD :  " more...(wip todo)\n...");
          }
          */
          //message.edit(message.content.match(new RegExp(CHAR_NAME_REGSTR, "g"))[0]+" -> "+dmNotify);
          let namer =  message.content.match(new RegExp(CHAR_NAME_REGSTR, "g"))[0];
          let charHandle = namer.split(":")[1];
          if (!charHandle) charHandle = "";
          else charHandle = ": "+charHandle;
          /*
          message.edit(new Discord.RichEmbed({
            "description": dmNotify, //remainingContents[remainingContents.length-1]
            "author": {
              "name": member.displayName+charHandle, // + (remainingContents.length > 1 ? remainingContents[0] : ""),
              "icon_url": user.displayAvatarURL
            }
          }));
          */
          message.edit(namer + dmNotify);
        } else {
          messageReaction.remove(user);
        }
      }
    });
   
    //console.log( messageReaction.message.embeds[0]);
    //if (messageReact.channel.la)
    
    // remove reactions on messages from users that aren't mentioned in turn
    //if (messageReaction.remove(user));
  });
  
  client.on("messageUpdate", (oldMessage, newMessage) => {
    //console.log(newMessage);
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
                    // console.log("Ready fecht:"+f._id)
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
        } else {
          Fecht.deleteOne({channel_id: channel.id}).then((s)=> {
            if (s && s.deletedCount > 0) {
              CHANNELS_FECHT[channel.id] = null;
              channel.send(new Discord.RichEmbed({color:COLOR_GAMEOVER, description:"-- FECHT OVER! We have ended! --"}));
            } else sendTempMessage("There is no fecht currently in progress.", channel);
          });

          message.delete();
          return;
        }
        message.delete();
      }


      if (CHANNELS_FECHT[channel.id] !== undefined) {
        if (!CHANNELS_FECHT[channel.id]) return;
      } else {
        Fecht.findOne({channel_id: channel.id}, "_id").then((f)=> {
          if (!f) {
            CHANNELS_FECHT[channel.id] = null;  
          }
        });
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
          // TODO: only allow if in fecht
          //remainingContents = remainingContents.split(" ", 2);
          //if (remainingContents.)
          
          channel.send(new Discord.RichEmbed({
            "description": remainingContents, //remainingContents[remainingContents.length-1]
            "author": {
              "name": message.member.displayName, // + (remainingContents.length > 1 ? remainingContents[0] : ""),
              "icon_url": message.author.displayAvatarURL
            }
          }));
        break;
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
            let phase = f.phases ? f.phases[0] : null;
            let gotTurnTick = !phase || (phase && !phase.reactOnly);
            await m.edit(new Discord.RichEmbed({title:TITLES.turnFor, description:abc.join(", ") + (gotTurnTick ? "\nPlease respond with the reaction icon below to finalise your turn." : "")}));
            if (gotTurnTick) {
              m.react("✅");
            }

            if (phase.dmReacts) {
              await channel.send(new Discord.RichEmbed({description:"Check (DM) direct messages from me AFTER you've tapped your reaction down below:"}));
            }
            if (phase && phase.reacts) {
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