/** Dotenv Environment Variables */
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
  }
  
  /** Connect to MongoDB */
  const mongoose = require('mongoose');
  require('./server/db/mongoose');
  
  const Discord = require('discord.js');
  const client = new Discord.Client();

  const { Fecht } = require('./server/model/Fecht')
  const {sendTempMessage} = require('./server/modules/general');

  const PREFIX = process.env.PREFIX;
  const COLOR_GAMEOVER = 0xdd33ee;

  // cache for channel_id to fechtId!
  const CHANNELS_FECHT = {};

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

  client.on("messageReactionAdd", (messageReaction, user) => {
    if (user.bot) {
      return;
    }
    // remove reactions on messages from users that aren't mentioned in turn
    //if (messageReaction.remove(user));
  });
  
  client.on("messageUpdate", (oldMessage, newMessage) => {

  });
  
  client.on("message", (message) => {
    if (message.author.bot) {
      return;
    }

    if (message.content.startsWith(PREFIX)) {
      var contentIndex = message.content.indexOf(" ");
      var command = contentIndex >= 0 ? message.content.slice(1, contentIndex) : message.content.slice(1);
      var remainingContents = contentIndex>=0 ? message.content.slice(contentIndex+1) : null;
      var channel = message.channel;
     
      if (CHANNELS_FECHT[channel.id] !== undefined) {
        if (!CHANNELS_FECHT[channel.id]) return;
      } else {
        if (command === "fechtstart") {
          message.delete();
          Fecht.findOne({channel_id: channel.id}, "_id").then((f)=> {
            if (f) {
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
                    console.log("Ready fecht:"+f._id)
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

          return;
        }
      }
  
      switch(command) {
        case "fechtstart":
          message.delete();
          sendTempMessage("Fecht is already in progress for this channel...", channel);
         break;
        case "fechtend":
          message.delete();
          delete CHANNELS_FECHT[channel.id];
          Fecht.deleteOne({channel_id: channel.id}).then((s)=> {
            if (s && s.deletedCount > 0) {
              channel.send(new Discord.RichEmbed({color:COLOR_GAMEOVER, description:"-- FECHT OVER! We have ended! --"}));
            } else  sendTempMessage("There is no fecht currently in progress.", channel);
          });
        break;
        case 'phase': // test single phase setting
          message.delete();
          if (!remainingContents) {
            sendTempMessage("Specify Phase JSON to test..", channel);
            return;
          }
          try {
            var parsedJSON = JSON.parse(remainingContents);
          }
          catch( err) {
             sendTempMessage("Failed to parse Phase JSON for test", channel);
             return;
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
          message.delete();
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
        return;
        case 'turn': // test single turn for phase
         
        break;
        default:

       break;
      }
  
    } else {  // plain text message, should clean up?
      var channel = message.channel;
      if (CHANNELS_FECHT[channel.id] !== undefined) {
        if (!CHANNELS_FECHT[channel.id]) return;
      }

    }
  });
  
  client.login(process.env.TOKEN);