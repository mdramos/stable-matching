"use strict";

let _ = require('lodash');
let dummyDb = require('./dummy_db')

function parseDb(db) {
	let output = {};
	let i = 0;

	while(i < db.length) {
		// init person preference object
		output[db[i].id] = {
			name: db[i].first_name + " " +  db[i].last_name,
			id: db[i].id,
			choices: []
		};
		
		// generate a rank for every other person (j reps ids, so start at 1)
		// keep track of unique/used weights
		let usedPrefs = [];
		for (var j = 1; j < db.length + 1; j++) {
			if(j != db[i].id) {
				let randomPref;
				// used to keep track of unique preferences (nodups)
				let newPref = false
				while(!newPref) {
					randomPref = Math.floor(Math.random()* db.length);
					if(usedPrefs.indexOf(randomPref) == -1) {
						usedPrefs.push(randomPref)
						newPref = true;
					} 
				}
				// create new match and preference weight
				output[db[i].id].choices.push({
					id: j,
					strength: randomPref
				});
			}
		};


		output[db[i].id].choices = _.sortBy(output[db[i].id].choices, o => { return o.strength; });

		i++;
	};	

	return output; 
}


var StableMatching = (function (data) {
	let _DB = data;
	
	function _proposalStage(iteration){
		let allProposed = false;
		let stable = false;
		let i = 1;

		while(!allProposed) {
			let sender = _DB[i];
			
			if(sender.hasAcceptedProposal) {
				// already has an accepted proposal, no need to continue
				i++;
			} else {
				// need to go through proposal stages for this person and their preferences
				// next offer is first choice in preference list that hasn't been proposed to yet
				let nextOfferIndex = _.findIndex(sender.choices, p => { return !p['offerSent'+iteration]; });	
				sender.choices[nextOfferIndex]['offerSent'+iteration] = true;
				// send offer to that person, proposeOffer will accept or reject the offer
				let accepted  = proposalProcess( sender, _DB[sender.choices[nextOfferIndex].id], sender.choices[nextOfferIndex].strength );
				if (accepted) {
					// move on to next person
					i++;
				} 
			}

			// status check to see if everyone has an accepted proposal
			let statusCheck = _.findKey(_DB, o => { return !o.hasAcceptedProposal; });
			if(!statusCheck) {
				allProposed = true;
				stable = true;
			} else {
				if(i == Object.keys(_DB).length + 1) {
					// refresh
					allProposed = true;
					stable = false;
				}
			}
		};

		if(!stable) {
			_proposalStage(iteration++);
		}
	}

	function proposalProcess(sender, receiver, receiverRank) {
		// we now need to check to see if the receiver has accepted proposals and 
		// how the receiver ranks the sender of the proposal 
		let indexOfsender = _.findIndex(receiver.choices, p => { return p.id == sender.id; });
		if( indexOfsender == -1 ) {
			// rejected because they are not in the list
			return false;
		} else {
			// create shortcut to senders object in receiver's list
			let senderRank = receiver.choices[indexOfsender].strength;
			if(receiver.hasAcceptedProposal) {
				// need to compare against accept proposal
				if(receiver.acceptedRank > senderRank) {
					// rejected because offer has already been accept by someone with higher preference
					rejectOffer(sender, null);
					return false;
				} else {
					// accepted because the sender outranks the previously accepted proposal
					// the previous proposal now needs to be denied
					let prevIndex = _.findIndex(receiver.choices, p => { return p.strength == receiver.acceptedRank; });
					rejectOffer(_DB[receiver.acceptedID], receiver);
					acceptOffer(sender, receiver, receiverRank, senderRank);
					return true;
				} 
			} else {
				// accepted because he does not have any accepted proposal
				acceptOffer(sender, receiver, receiverRank, senderRank);
				return true;
			}
		}	
	}

	function acceptOffer(sender,receiver, receiverRank, senderRank) {
		sender.hasAcceptedProposal = true;
		sender.acceptedRank = receiverRank;
		sender.acceptedID = receiver.id;
		receiver.hasAcceptedProposal = true;
		receiver.acceptedRank = senderRank;
		receiver.acceptedID = sender.id;
	}

	function rejectOffer(sender,receiver) {
		sender.hasAcceptedProposal = false;
		sender.acceptedRank = -1;
		sender.acceptedID = -1;
		if ( receiver != null ) {
			receiver.hasAcceptedProposal = false;
			receiver.acceptedRank = -1;
			receiver.acceptedID = -1;
		}
	}

	function _eliminateStage() {
		_.forIn(_DB, (person,id) => {
			let keepLast = _.findIndex(person.choices, function(p) { return p.id == person.acceptedID; });
			person.choices.length = (keepLast + 1);
		});
	}

	function cycleReduceStage() {
		let stable = false;
		let i = 1;
		// all or nothing phase 
		while(!stable) {
			let p = _DB[i].choices[1] // second remaining preference of starting person i
			let q = p.choices[p.choices.length -1 ] // last remaining preference of p
			let currentPair = [p,q];
			let cyclePairs = [];
			// cyclic reduction
			let cycle = false;
			while(!cycle) {
				p = q.choices[1]; 
				q = p.choices[p.choices.length -1 ];
				let newPair = [p,q];
				cyclePairs.push(newPair);

				if(newPair == currentPair) {
					cycle = true;
					// TODO remove dyagnals in cyclePairs
				}
			}

			// TODO if everyone has 1 remainging match then stable
			
		}
	}

	
	return {	
		init: function(db) {
			_DB = db;
		},
		doStageOne: function() {
			_proposalStage(0);
			console.log("stage one done");
		},
		testStageOne: function() {
			_.forIn(_DB, (obj,person) => {
					console.log(obj.name + "    =======>     " + _DB[obj.acceptedID].name)	
			})
		},
		doStageTwo: function(){
			_eliminateStage(_DB);
		}
	};

})();

let personPreferredLists = parseDb(dummyDb);
StableMatching.init(personPreferredLists);
StableMatching.doStageOne();
// StableMatching.testStageOne();
StableMatching.doStageTwo();


