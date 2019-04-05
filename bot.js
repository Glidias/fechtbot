/** Dotenv Environment Variables */
if (process.env.NODE_ENV !== 'production') {
	require('dotenv').config();
  }
  
  /** Connect to MongoDB */
  const mongoose = require('mongoose');
  require('./server/db/mongoose');
  
  const Discord = require('discord.js');
  const client = new Discord.Client();
  const TEST = require('./server/tests/seed/seedFunctions')
  
  const PREFIX = process.env.PREFIX;
  
  var initiative_table = [];
  
  function sort_lowestFirst(a, b) {
	var diff = a.initVal - b.initVal
	if(diff == 0) {
	  return Math.random() < 0.5 ? -1 : 1;
	}
	return diff;
  }
  
  function sort_lowestFirstNegFlip(a, b) {
	a = a.initVal;
	b = b.initVal;
  
	var diff = a - b;
	if(diff === 0) {
	  return Math.random() < 0.5 ? -1 : 1;
	}
  
	if (a < 0 && b < 0) {
	  return -diff;
	}
	return diff;
  }
  
  function sort_highestFirst(a, b) {
	var diff = b.initVal - a.initVal
	if(diff == 0) {
	  return Math.random() < 0.5 ? -1 : 1;
	}
	return diff;
  }
  
  function sort_highestFirstNegFlip(a, b) {
	a = a.initVal;
	b = b.initVal;
  
	var diff = b - a;
	if(diff == 0) {
	  return Math.random() < 0.5 ? -1 : 1;
	}
  
	if (a < 0 && b < 0) {
	  return -diff;
	}
	return diff;
  }
  
  function addUnit(name, roll) {
	if(name === undefined || roll === undefined) throw 'Both a Name and Initiative Roll are required.';
	if(Number.isNaN(roll)) throw 'Initiative Roll must be an integer.';
  
	var player = {
	  'name': name,
	  'initVal': roll
	};
	initiative_table.push(player);
  
	//sort initiative_table
	initiative_table.sort(sort_highestFirstNegFlip);
  }
  
  function removeUnit(rank) {
	if(rank === undefined || Number.isNaN(rank)) throw 'An integer Rank is required.';
	if(rank <= 0 || rank > initiative_table.length) throw 'Invalid unit specified. Rank out of bounds.';
  
	return initiative_table.splice(rank-1, 1);
  }
  
  function switchUnits(rank1, rank2) {
	if(rank1 === undefined || rank2 === undefined) throw 'Two Ranks are required.';
	if(Number.isNaN(rank1) || Number.isNaN(rank2)) throw 'Ranks must be integers.';
	if(rank1 <= 0 || rank1 > initiative_table.length) throw 'Invalid first unit specified. Rank out of bounds.';
	if(rank2 <= 0 || rank2 > initiative_table.length) throw 'Invalid second unit specified. Rank out of bounds.';
  
	var temp = initiative_table[rank1 - 1];
	initiative_table[rank1 - 1] = initiative_table[rank2 - 1];
	initiative_table[rank2 - 1] = temp;
  }
  
  function nameUnit(rank, name) {
	if(rank === undefined || name === undefined) throw 'Both a Rank and Name are required.';
	if(Number.isNaN(rank)) throw 'Rank must be an integer.';
	if(rank <= 0 || rank > initiative_table.length) throw 'Invalid unit specified. Rank out of bounds.';
  
	initiative_table[rank - 1].name = name;
  }
  
  function format_order() {
	if(initiative_table.length < 1) throw 'Initiative Order is Empty.';
  
	var embed = new Discord.RichEmbed();
  
	//TODO: Differentiate between PC/NPC or Party/Enemies?
  
	order_text = '';
	for (var i = 0; i < initiative_table.length; i++) {
	  var rank = i+1;
	  order_text += rank + ': **' + initiative_table[i].name + '** (' + initiative_table[i].initVal + ')\n';
	}
  
	embed.addField('Initiative Order', order_text);
  
	return embed;
  }
  
  function deleteMessage(message) {
	message.delete().catch((e) => {
	  console.log(e);
	});
  }
  
  function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  function sendTempMessage(text, channel) {
	channel.send(text)
	  .then((message) => {
		delayedDelete(message, 4);
	  });
  }
  
  async function delayedDelete(message, ms) {
	await sleep(ms);
	deleteMessage(message);
  }
  
  client.on("ready", () => {
	console.log("Initiative bot Online!");
  });
  
  client.on("message", (message) => {
	if (message.author.bot) return;
	
	if (message.content.startsWith(PREFIX)) {
	  console.log("..Message Received: " + message.content);
	 
	  var args = message.content.split(' ');
	  var command = args.shift().substring(1).toLowerCase(); //First argument is always the command. Strip the '$'
	  var channel = message.channel;
  
	  switch(command) {
		case 'roll':
		 // message.author.send("A");
		 // message.reply("Your edited roll was invalid. Your message wasn't updated.");
		break;
		case 'add':
		  try {
			let name = args.slice(0, args.length - 1).join(' ');
			addUnit(name, args[args.length-1]);
			sendTempMessage("Added " + name + " to the initiative order.", channel);
		  } catch (e) {
			console.log(e);
			message.author.send(e); //This needs to be changed eventually
		  }
		  deleteMessage(message);
		  break;
		case 'remove':
		  try {
			let unit = removeUnit(args[0]);
			sendTempMessage("Removed " + unit[0].name + " from the initiative order.", channel);
		  } catch (e) {
			console.log(e);
			message.author.send(e);
		  }
		  deleteMessage(message);
		  break;
		case 'switch':
		  try {
			switchUnits(args[0], args[1]);
			sendTempMessage("Unit order switched.", channel);
		  } catch (e) {
			console.log(e);
			message.author.send(e);
		  }
		  deleteMessage(message);
		  break;
		case 'name':
		  try {
			nameUnit(args[0], args.slice(1).join(' '));
			sendTempMessage("Unit renamed.", channel);
		  } catch (e) {
			console.log(e);
			message.author.send(e);
		  }
		  deleteMessage(message);
		  break;
		case 'order':
		  try {
			message.channel.send(format_order());
		  } catch(e) {
			console.log(e);
			message.author.send(e);
		  }
		  deleteMessage(message);
		  break;
		case 'reset':
		  initiative_table = [];
		  deleteMessage(message);
		  break;
	  }
  
	}
  });
  
  client.login(process.env.TOKEN);