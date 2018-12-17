const fs = require('fs');
const http = require('http');
const path = require('path');
const express = require('express');
const bodyParser  = require('body-parser');
const morgan      = require('morgan');
const mongoose    = require('mongoose');
const jwt    = require('jsonwebtoken'); // used to create, sign, and verify tokens

var config = require('./config'); // get our config file
var Category   = require('./models/categorymodel');
var User   = require('./models/usermodel'); // get our mongoose model
var Tree = require('./models/treemodel');
var ApprovableTree = require('./models/treesforapprovemodel')
var Skill = require('./models/skillmodel');
var ApprovableSkill = require('./models/skillsforapprovemodel');
var ApprovableTraining = require('./models/trainingsforapprovemodel');
var pbkdf2 = require('./pbkdf2'); // get hash generator and pw checker

const app = express();

mongoose.connect(config.database); // connect to database
app.set('superSecret', config.secret);

// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// use morgan to log requests to the console
app.use(morgan('dev'));

// serving static files and opening login.html
app.use(express.static('./public'));
app.get('/', (req, res) => res.sendFile('login.html', { root: path.join(__dirname, './public') }));
app.get('/user', (req, res) => res.sendFile('chartandtree.html', { root: path.join(__dirname, './public/user') }));

app.post('/registration', async function(req, res) {
	// search for username in db
    var user = await User.findOne({
        username: req.body.username,
    }, function (err, user) {
        if (err) throw err;
		return user;
    });

	if (!user) { // if new user
		var hashData = pbkdf2.hashPassword(req.body.password);

		var focusAreaTrees = await Tree.find({focusArea: req.body.focusArea}, {_id: 0, name: 1}, function (err, trees) {
							if (err) throw err;
							return trees;
						});

		for (var i = 0; i < focusAreaTrees.length; ++i) {
			focusAreaTrees[i] = focusAreaTrees[i].name; //	lehet enelkul?
		}

		// get all categories from db
		var categories = await Category.find({}, function (err, categories) {
							if (err) throw err;
							return categories;
						});

		var newUser = new User({
			username: req.body.username,
			email: req.body.email,
			hashData: hashData,
			categories: categories,
			focusArea: {
					name: req.body.focusArea,
					treeNames: focusAreaTrees,
				},
			willingToTeach: req.body.willingToTeach
		});

		newUser.save(function(err) {
			if (err) throw err;

			const payload = {
				username: req.body.username,
			};
			var token = jwt.sign(payload, app.get('superSecret'), {
				expiresIn: '60m' // expires in 1 hour
			});

			// return the information including token as JSON
			res.json({
				success: true,
				token: token,
			});
		});
	} else { // if user already exists
		res.json({
			success: false
		});
	}
});

app.post('/auth', function(req, res) {
    // find the user
    User.findOne({
        username: req.body.username
    }, function(err, user) {
        if (err) throw err;

        if (!user) {
            res.json({
                success: false,
                message: 'Authentication failed. User not found.'
            });
        } else if (user) {
            // check password
            if (!pbkdf2.verifyPassword(req.body.password, user.hashData)) {
                res.json({
                    success: false,
                    message: 'Authentication failed. Wrong password.'
                });
            } else {
                // if user is found and password is right
                // create a token with only our given payload
                // we don't want to pass in the entire user since that has the password
                const payload = {
                    username: req.body.username,
                };
                var token = jwt.sign(payload, app.get('superSecret'), {
                    expiresIn: '60m' // expires in 1 hour
                });

                // return the information including token as JSON
                res.json({
                    success: true,
                    token: token,
                    message: "Authenticated.",
                });
            }

        }

    });
});


//Creating a getRoute thats protected with token, API calls are under /get/...
var getRoute = express.Router();
app.use('/get', getRoute);

getRoute.use(function(req, res, next) {
  var token = req.get('x-access-token');

  // decode token
  if (token) {
    // verifies secret and checks exp
    jwt.verify(token, app.get('superSecret'), function(err, decoded) {
      if (err) {
        return res.sendFile('login.html', { root: path.join(__dirname, './public') })
        /*return res.json({
        success: false,
        message: 'Failed to authenticate token.'
      });*/
    } else {
      req.decoded = decoded;
      next();
    }
  });

} else {
  // if there is no token
  // return an error
  /*
  return res.status(403).send({
  success: false,
  message: 'No token provided.'
});*/
return res.sendFile('login.html', { root: path.join(__dirname, './public') });

}
});

getRoute.get('/userdata', function (req, res) {
    User.findOne({
        username: req.decoded.username
    }, async function(err, userdata) {
        if (err) throw err;

        if (!userdata) {
            res.json({
                success: false,
                message: 'User not found.'
            });
        } else if (userdata) {
			user = userdata.toObject();
			delete user.__v;
			delete user._id;
			delete user.email;
			delete user.hashData;

			if (user.mainTree != undefined) { // first login
				delete user.focusArea;
			}

            if (user.admin) {
                var trees = await ApprovableTree.find({}, function(err, trees) {
    		        if (err) throw err;
    				return trees;
    		    });

                var skills = await ApprovableSkill.find({}, function(err, skills) {
    		        if (err) throw err;
    				return skills;
    		    });

                var trainings = await ApprovableTraining.find({}, function(err, trainings) {
    		        if (err) throw err;
    				return trainings;
    		    });

                user.apprTrees = trees;
                user.apprSkills = skills;
                user.apprTrainings = trainings;
            }

      		return res.json(user);
      	}
    });
});



// getting the skilldata of a skillname (used for offers)
getRoute.get('/offers', function(req, res) {
	Skill.findOne({
		name: req.body.name
	}, async function(err, skilldata) {
		if(err) throw err;

		if(!skilldata){
			escape.json({
				succes: false,
				message: 'User not found.'
			});
		} else if (skilldata) {
			skill = skilldata.toObject();

			return res.json(skilldata);
		}
	});
});

// getting the skilldata of a skillname (used for offers)
getRoute.get('/skillsforapproval', function(req, res) {
	ApprovableSkill.find( {} , async function(err, skillsforapproval) {
		if(err) throw err;

		if(skillsforapproval !== undefined){
				return res.json(skillsforapproval);
		} else
			{
				res.json({
					succes: false,
					message: 'User not found.'
				});
		}
	});
});



// Creating a setRoute, thats protected with Token. API calls are under /set/...
var setRoute = express.Router();
app.use('/set', setRoute);

setRoute.use(function(req, res, next) {
    var token = req.get('x-access-token');

    // decode token
    if (token) {
        // verifies secret and checks exp
        jwt.verify(token, app.get('superSecret'), function(err, decoded) {
            if (err) {
                return res.json({
                    success: false,
                    message: 'Failed to authenticate token.'
                });
            } else {
                req.decoded = decoded;
                next();
            }
        });

    } else {
        // if there is no token
        // return an error
        return res.status(403).send({
            success: false,
            message: 'No token provided.'
        });

    }
});
setRoute.use(express.json());

// Search for users to view by name
setRoute.post('/searchUsersByName', async function (req, res) {
		var data = req.body;
		var foundUsers = await User.find({
					"username": {$regex : ".*" + data.value + ".*", '$options' : 'i'}
			}, function (err, user) {
					if (err) throw err;
			return user;
		});
		var resUsers = [];
		for (var i = 0; i < foundUsers.length; i++) {
			resUsers[i] = {name: foundUsers[i].username};
		}
		res.json(resUsers);
});

// searchkes a skill for editor
setRoute.post('/searchSkillsByName', async function (req, res) {
		var data = req.body;

        var user = await User.findOne({
            username: req.decoded.username
        }, function(err, user) {
            if (err) throw err;
    		return user;
        });

        user = user.toObject();
        var foundUserSkills = user.skills.filter(obj => obj.name.match(new RegExp(".*" + data.value + ".*", "i")) != null);

        var foundGlobalSkills = await Skill.find({
            "name": {$regex : ".*" + data.value + ".*", '$options' : 'i'}
        }, function (err, skills) {
            if (err) throw err;
            return skills;
        });

        var resSkills = [];
        for (var i = 0; foundUserSkills != undefined && i < foundUserSkills.length; i++) {
            resSkills.push({name: foundUserSkills[i].name});
        }
        for (var i = 0; i < foundGlobalSkills.length; i++) {
            if (resSkills.find(obj => obj == foundGlobalSkills[i].name) == undefined) resSkills[i] = {name: foundGlobalSkills[i].name};
        }
        res.json(resSkills);
});

// searchkes a skill for editor
setRoute.post('/searchUserSkillsByName', async function (req, res) {
		var data = req.body;

        var user = await User.findOne({
            username: req.decoded.username
        }, function(err, user) {
            if (err) throw err;
    		return user;
        });

        user = user.toObject();
        var foundUserSkills = user.skills.filter(obj => obj.name.match(new RegExp(".*" + data.value + ".*", "i")) != null);

        var resSkills = [];
        for (var i = 0; foundUserSkills != undefined && i < foundUserSkills.length; i++) {
            resSkills.push({name: foundUserSkills[i].name});
        }

        res.json(resSkills);
});

// Search for trees to add while typing
setRoute.post('/searchTreesByName', async function (req, res) {
		var data = req.body;
		var foundTrees = await Tree.find({
					"name": {$regex : ".*" + data.value + ".*", '$options' : 'i'}
			}, function (err, tree) {
					if (err) throw err;
			return tree;
		});
		var resTrees = [];
		for (var i = 0; i < foundTrees.length; i++) {
			resTrees[i] = {name: foundTrees[i].name};
		}
		res.json(resTrees);
});


// Getting the name, skills, trees and maintree of a user. (will be needed for advanced search)
setRoute.post('/getPublicUserData', async function (req, res) {
		var data = req.body;
    var foundUsers = await User.find({
					"username": {$regex : ".*" + data.value + ".*", '$options' : 'i'}
			}, 'username skills trees maintree', function (err, user) {
					if (err) throw err;
			return user;
		});
		res.json(foundUsers);
});

// Getting the name, skillnames, focusarea of a tree. (will be needed for advanced search)
setRoute.post('/getPublicTreeData', async function (req, res) {
		var data = req.body;
    var foundTrees = await Tree.find({
					"name": {$regex : ".*" + data.value + ".*", '$options' : 'i'}
			}, function (err, tree) {
					if (err) throw err;
			return tree;
		});
    res.json(foundTrees);
});

// Getting the name, caterory, desc, relations and training data of a skill. (will be needed for advanced search)
setRoute.post('/getPublicSkillData', async function (req, res) {
    var data = req.body;
    var foundSkills = await Skill.find({
				"name": {$regex : ".*" + data.value + ".*", '$options' : 'i'}
		}, 'name categoryName description parents children trainings', function(err, skill) {
				if (err) throw err;
		return skill;
		});
    res.json(foundSkills);
});

// Adds a public tree to the current user.
setRoute.post('/addTreeToUser', async function (req, res){
	var data = req.body;
	var user = await User.findOne({
			username: req.decoded.username
	}, function(err, user) {
			if (err) throw err;
	return user;
	});
	var tree = await Tree.findOne({"name": data.value},  function (err, tree) {
		if (err) throw err;
		return tree;
	});

	if (tree != undefined) {
		if (user.trees.find(obj => obj.name == tree.name) == undefined){
			user.trees.push(tree);

			var skills = await Skill.find({
	        	name: tree.skillNames,
	    	}, function (err, skills) {
	        	if (err) throw err;
				return skills;
	    	});

			await skills.forEach(function (skill) {
				skill.achievedPoint = 0;
                if (user.skills.find(obj => obj.name == skill.name) == undefined) user.skills.push(skill);
			});

			user.save(function (err) {if (err) throw err;});

			res.json({
				success: true,
				name: tree.name
			});
		} else {
			res.json({
				message: "existing",
				success: false
			});
		}
	} else {
		res.json({
			message: "notfound",
			success: false
		});
	}
});

//Approve a skill thats sent in the body as skillforaproval to the api
setRoute.post('/approveskill', async function (req, res)  {

	var skillforapproval = req.body;

	var approvecollection = await ApprovableSkill.find( {} , async function(err, approvecollection) {
		if(err) throw err;
		else return approvecollection;
	});


	//Look for the skill in the database, if already exists
	var globalskill = undefined;
	globalskill = await Skill.findOne( { name : skillforapproval.name } , async function(err, globalskill){
		if(err) throw err;
		else return globalskill;
	});

	console.log(globalskill);

	//Check if skill is already in the database or not
	if(globalskill !== null )
		{
			res.json({
				success: false,
				message: "Skill already exists"
			});
		}
	else  //If its not, add to the database
	{
		newGlobalSkill = new Skill({
			name: skillforapproval.name,
			categoryName: skillforapproval.categoryName,
			skillIcon: skillforapproval.skillIcon,
			description: skillforapproval.description,
			pointDescription: skillforapproval.pointDescription,
			maxPoint: skillforapproval.maxPoint,
			parents: skillforapproval.parent,
			children: [
				{
					name: skillforapproval.name,
					minPoint: skillforapproval.minPoint,
					recommended: skillforapproval.recommended
				}
			],
			trainings: [
				{
					name: skillforapproval.name,
					level: skillforapproval.minPoint,
					description: skillforapproval.recommended,
					url: skillforapproval.url,
					urlLastAccessed: skillforapproval.urlLastAccessed
				}
			]
			});
			newGlobalSkill.save();

			console.log(approvecollection);
			console.log("----------");
			var dependency = [];
			await getDependency(approvecollection, skillforapproval, dependency);

			console.log(dependency);

			var lastdependency = dependency[dependency.length-1];

			for(var i=0;i<dependency.length;i++)
			{

				var globalskill = await Skill.findOne( { name : dependency[i].name } , async function(err, globalskill){
					if(err) throw err;
					else return globalskill;
				});


				if(globalskill !== null)
				{
					res.json({
						success: false,
						message: "dependency " +i + " " + dependency[i].name + " is already in database"
					});
				}
				else
					{
						newGlobalSkill = new Skill({
							name: dependency[i].name,
							categoryName: dependency[i].categoryName,
							skillIcon: dependency[i].skillIcon,
							description: dependency[i].description,
							pointDescription: dependency[i].pointDescription,
							maxPoint: dependency[i].maxPoint,
							parents: dependency[i].parent,
							children: [
								{
									name: dependency[i].name,
									minPoint: dependency[i].minPoint,
									recommended: dependency[i].recommended
								}
							],
							trainings: [
								{
									name: dependency[i].name,
									level: dependency[i].minPoint,
									description: dependency[i].recommended,
									url: dependency[i].url,
									urlLastAccessed: dependency[i].urlLastAccessed
								}
							]
							});
							newGlobalSkill.save();

					}


			}

			for(var i=0; i<lastdependency.parents.length; i++)
			{
				var lastdependencyParent =  await Skill.find( { name : lastdependency.parents[i] } , async function(err, lastdependencyParent){
					if(err) throw err;
					else return lastdependencyParent;
				});

				lastdependencyParent.children.push({
						name: lastdependency.name,
            			minPoint: 0, //TODO skillsforapproval model to be changed, got no real data to be read
            			recommended: false // ^
				});

				lastdependencyParent.save();

				res.json({
					message: "Succes",
					success: true
				});

			}

	}

});



// gets a skill and all it's dependencies by name.
setRoute.post('/getskill', async function (req, res) {
	var data = req.body;

    var user = await User.findOne({
        username: req.decoded.username
    }, function(err, user) {
        if (err) throw err;
		return user;
    });

	if (!user) {
		res.json({
			success: false,
			message: 'User not found.'
		});
	} else {
        var skill = user.skills.find(obj => obj.name == data.value);

        if (skill == undefined) {
            var skill = await Skill.findOne({name: data.value} , function (err, skill) {
        				if (err) throw err;
        				return skill;
        	});

        	if (!skill) {
        		res.json({
        			success: false
        		});
        	}
        }

    	var dependency = [];
    	await getDependency(user.skills, skill, dependency);

    	res.json({
    		success: true,
    		skill: skill,
    		dependency: dependency
    	});
    }
});

// recursive function for dependency determinating
async function getDependency (userSkills, skill, dependency) {
	var parents = [];
	for (var i = 0; skill.parents != undefined && i < skill.parents.length; ++i) {
        var parent = userSkills.find(obj => obj.name == skill.parents[i]);

        if (parent == undefined) {
            parent = await Skill.findOne({name: skill.parents[i]} , function (err, skill) {
                if (err) throw err;
                return skill;
            });
        }

		parents.push(parent);
		dependency.push(parent);
	}

	for (var i = 0; i < parents.length; ++i) {
		await getDependency(userSkills, parents[i], dependency);
	}
}


// variable used for insertSkill
var rootlevel = 0;

// inserts a skill to a tree.
async function insertSkill(skillToInsert, skillArray) {
	if (!skillArray.includes(skillToInsert)) {
		if (skillArray.length === 0) {
			skillToInsert.level = rootlevel;
			skillArray.push(skillToInsert);
			return;
		}
		else {
			for (var i = 0; i < skillToInsert.parents.length; i++) {
				var ithParent = await Skill.findOne({
						name: skillToInsert.parents[i]
				}, function(err, skill) {
						if (err) throw err;
						return skill;
				});
				if (skillArray.find(obj => obj.name == ithParent.name) !== undefined) {
					ithParent = skillArray.find(obj => obj.name == ithParent.name);
					for (var j = 0; j < ithParent.children.length; j++) {
						var ithChild = await Skill.findOne({
								name: ithParent.children[j].name
						}, function(err, skill) {
								if (err) throw err;
						return skill;
						});
						if (skillArray.find(obj => obj.name == ithChild.name) !== undefined) {
							ithChild = skillArray.find(obj => obj.name == ithChild.name);
							var svc = 0;
							while (ithChild.name !== skillArray[svc].name) {
								svc++;
							}
							skillToInsert.level = ithChild.level;
							skillArray.splice(svc, 0, skillToInsert);
							return;
						}
					}
					var svp = 0;
					while (skillArray[svp] !== undefined && skillArray[svp].level <= ithParent.level) {
						svp++;
					}
					skillToInsert.level = ithParent.level + 1;
					skillArray.splice(svp, 0, skillToInsert);
					return;
				}
			}

			for (var i = 0; i < skillToInsert.children.length; i++) {

                var ithChild = user.skills.find(obj => obj.name == skillToInsert.children[i].name);

                if (ithChild == undefined) {
                    ithChild = await Skill.findOne({
    						name: skillToInsert.children[i].name
    				}, function(err, skill) {
    						if (err) throw err;
    				        return skill;
    				});
                }

				if (skillArray.find(obj => obj.name == ithChild.name) !== undefined) {
					ithChild = skillArray.find(obj => obj.name == ithChild.name);
					var c = 0;
					while (skillArray[c] !== undefined && [c].level < ithChild.level) {
						c++;
					}
					skillToInsert.level = ithChild.level - 1;
					skillArray.splice(c, 0, skillToInsert);
					if (skillToInsert.level < rootlevel) rootlevel = skillToInsert.level;
					return;
				}
			}

			var sn = 0;
			while (skillArray[sn] !== undefined && skillArray[sn].level === rootlevel) {
				sn++;
			}
			skillToInsert.level = rootlevel;
			skillArray.splice(sn, 0, skillToInsert);
			return;
		}
	}
}

// gets the skillnames of a skillarray.
async function extractNames(skillArray){
	var exctractedArray = [];
	for (var i = 0; i < skillArray.length; i++) {
		exctractedArray[i] = skillArray[i].name;
	}
	return exctractedArray;
}

// creates an ordered tree from an array of skills.
async function sortTree(skillArray){
	rootlevel = 0;
	var sortedArray = [];
	for (var i = 0; i < skillArray.length; i++) {
		await insertSkill(skillArray[i], sortedArray);
	}
	skillArray = await extractNames(sortedArray);
	return skillArray;
}

setRoute.post('/newtraining', async function(req, res) {
    var data = req.body;

    var user = await User.findOne({
        username: req.decoded.username
    }, function(err, user) {
        if (err) throw err;
		return user;
    });

	if (!user) {
		res.json({
			success: false,
			message: 'User not found.'
		});
	} else if (user.skills.find(obj => obj.name == data.skillName) != undefined) {
        for (var i = 0; i < data.trainings.length; ++i) {
            user.skills.find(obj => obj.name == data.skillName).trainings.push({
                name: data.trainings[i].name,
                level: data.trainings[i].level,
                description: data.trainings[i].description,
                url: data.trainings[i].url
            });
        }

        user.save(function (err) {if (err) throw err;});

        if (data.forApprove) {
            for (var i = 0; i < data.trainings.length; ++i) {
                var apprTraining = new ApprovableTraining({
                    username: user.username,
                    skillName: data.skillName,
                    name: data.trainings[i].name,
                    level: data.trainings[i].level,
                    description: data.trainings[i].description,
                    url: data.trainings[i].url
                });

                apprTraining.save(function (err) {if (err) throw err;});
            }
        }

		res.json({
			success: true
		});
	} else {
		res.json({
			success: false,
			message: 'skillnotexists'
		});
	}
});

// Creates a skill from the data the user added.
setRoute.post('/newskill', async function(req, res) {
    var data = req.body;

    var user = await User.findOne({
        username: req.decoded.username
    }, function(err, user) {
        if (err) throw err;
		return user;
    });

	if (!user) {
		res.json({
			success: false,
			message: 'User not found.'
		});
	} else if (user.skills.find(obj => obj.name == data.name) == undefined) {
        var parentNames = [];
        for (var i = 0; i < data.parents.length; ++i) {
            if (user.skills.find(obj => obj.name == data.parents[i].name) == undefined) { // add parent skill to user if not already there
                var parent = await Skill.findOne({
						name: data.parents[i].name
				}, function(err, skill) {
						if (err) throw err;
						return skill;
				});
                user.skills.push(parent);
            }
            // add new skill as child of parent skill
            user.skills.find(obj => obj.name == data.parents[i].name).children.push({name: data.name, minPoint: data.parents[i].minPoint, recommended: data.parents[i].recommended});
            // when we save the new skill we only need the name of the parents (no minPoint and recommended)
            parentNames.push(data.parents[i].name);
        }

		user.skills.push({
            name: data.name,
            description: data.description,
            skillIcon: data.skillIcon,
            categoryName: data.categoryName,
            achievedPoint: 0,
            maxPoint: data.maxPoint,
            pointDescription: data.pointDescription,
            parents: parentNames,
            //children: data.children,
            trainings: data.trainings
        });

        /*for (var i = 0; i < data.children.length; ++i) {
            user.skills.find(obj => obj.name == data.children[i].name).parents.push(data.name);
        }*/

        user.save(function (err) {if (err) throw err;});

        if (data.forApprove) {
            for (var i = 0; i < data.parents.length; ++i) {
                var apprParent = await ApprovableSkill.find({
                    name: data.parents[i].name
                }, function (err, skill) {
        	        if (err) throw err;
        			return skill;
        	    });

                if (apprParent != undefined) {
                    apprParent.children.push({name: data.name, minPoint: data.parents[i].minPoint, recommended: data.parents[i].recommended});
                    apprParent.save(function (err) {if (err) throw err;});
                }
            }

            var apprSkill = new ApprovableSkill({
                username: user.username,
                name: data.name,
                description: data.description,
                skillIcon: data.skillIcon,
                categoryName: data.categoryName,
                maxPoint: data.maxPoint,
                pointDescription: data.pointDescription,
                parents: parentNames,
                children: data.children,
                trainings: data.trainings
            });

            apprSkill.save(function (err) {if (err) throw err;});
        }

		res.json({
			success: true
		});
	} else {
		res.json({
			success: false,
			message: 'skillexists'
		});
	}
});

// creates a new tree only for the user.
setRoute.post('/newtree', async function (req, res) {
	var data = req.body;
    var user = await User.findOne({
        username: req.decoded.username
    }, function(err, user) {
        if (err) throw err;
		return user;
    });
	if (!user) {
		res.json({
			success: false,
			message: 'User not found.'
		});
	}
	else if (user.trees.find(obj => obj.name == data.name) == undefined) {
		var sn = await sortTree(data.skills);
		user.trees.push({name: data.name, focusArea: data.focusArea, skillNames: sn});

        await data.skills.forEach(async function (skill) {
            /*var skill = await Skill.findOne({
                name: skillName,
            }, function (err, skill) {
                if (err) throw err;
                return skill;
            });*/

            skill.achievedPoint = 0;
            if (user.skills.find(obj => obj.name == skill.name) == undefined) {
                user.skills.push(skill);
            }
        });

		user.save(function (err) {if (err) throw err;});

        if (data.forApprove) {
            var tree = new ApprovableTree({
                name: data.name,
                username: user.username,
                focusArea: data.focusArea,
                skillNames: sn
            });

            tree.save(function (err) {if (err) throw err;});
        }

		res.json({
			success: true
		});
	}
	else {
		res.json({
			success: false,
			message: 'treeexists'
		});
	}
});

// add skill to user tree
setRoute.post('/addskilltotree', async function(req, res) {
    var data = req.body;

    var user = await User.findOne({
        username: req.decoded.username
    }, function(err, user) {
        if (err) throw err;
		return user;
    });

	if (!user) {
		res.json({
			success: false,
			message: 'User not found.'
		});
	} else {
		user.trees.find(obj => obj.name == data.treeName).skillNames.push(data.name);
		user.save(function (err) {if (err) throw err;});
	}
});

// gets the skilldata of a skillname
setRoute.post('/skilldata', function(req, res) {
	Skill.findOne({
		name: req.body.name
	}, async function(err, skilldata) {
		if(err) throw err;

		if(!skilldata){
			escape.json({
				succes: false,
				message: 'Skill not found.'
			});
		} else if (skilldata) {
			//skill = skilldata.toObject();

			return res.json(skilldata);
		}
	});
});

// approves a tree.
setRoute.post('/approvetree', async function (req, res) {
	var data = req.body;

    var user = await User.findOne({
        username: req.decoded.username
    }, function(err, user) {
        if (err) throw err;
		return user;
    });

	if (!user) {
		res.json({
			success: false,
			message: 'User not found.'
		});
	} else {
		var tree = new Tree();
		tree = user.trees.find(obj => obj.name == data.name);
		tree.save(function (err) {if (err) throw err;});
	}
});

setRoute.post('/approvetraining', async function (req, res) {
	var data = req.body;

    var training = await ApprovableTraining.findOne({
        username: data.username,
        skillName: data.skillName,
        name: data.name
    }, function(err, training) {
        if (err) throw err;
		return training;
    });

    var globalSkill = await Skill.findOne({
        skillName: data.skillName
    }, function(err, skill) {
        if (err) throw err;
		return skill;
    });

    globalSkill.trainings.push({
        name: training.name,
        level: training.level,
        description: training.description,
        url: training.url,
    });

    globalSkill.save(function (err) {if (err) throw err;});

    User.find({} , (err, users) => {
        if (err) throw err;

        users.map(user => {
            if (user.skills.find(obj => obj.name == data.skillName) != undefined) {
                user.skills.find(obj => obj.name == data.skillName).trainings.push({
                    name: training.name,
                    level: training.level,
                    description: training.description,
                    url: training.url,
                });
            }
        })
    })
});

// sets the user data aquired from the first login
setRoute.post('/firstlogindata', async function (req, res) {
	var data = req.body;

    var user = await User.findOne({
        username: req.decoded.username
    }, function(err, user) {
        if (err) throw err;
		return user;
    });

	if (!user) {
		res.json({
			success: false,
			message: 'User not found.'
		});
	} else {
		user.mainTree = data.mainTree;
		if (user.willingToTeach) {
			user.teachingDay = data.teachingDay;
			user.teachingTime = data.teachingTime;
			user.location = data.location;
		}

		var mainTree = await Tree.findOne({
	        name: user.mainTree,
	    }, function (err, tree) {
	        if (err) throw err;
			return tree;
		});

		user.trees.push(mainTree);

		var skills = await Skill.find({
	        name: mainTree.skillNames,
	    }, function (err, skills) {
	        if (err) throw err;
			return skills;
	    });

		await skills.forEach(function (skill) {
			skill.achievedPoint = 0;
			user.skills.push(skill);
		});

		user.save(function (err) {if (err) throw err;});
		res.json({
			success: true,
		});
	}
});

// submits all changes made by the user to the skills.
setRoute.post('/submitall', async function (req, res) {
	var data = req.body;

    var user = await User.findOne({
        username: req.decoded.username
    }, function(err, user) {
        if (err) throw err;
		return user;
    });

	if (!user) {
		res.json({
			success: false,
			message: 'User not found.'
		});
	} else {
		user.skills = data;

		if (user.willingToTeach) {
			var globalSkills = await Skill.find({}, function(err, skills) {
		        if (err) throw err;
				return skills;
		    });

			data.forEach(function (userSkill) {
                var globalSkill = globalSkills.find(obj => obj.name == userSkill.name);
                if (globalSkill != undefined) {
                    if (userSkill.achievedPoint > 0) {
                        if (globalSkill.offers.find(obj => obj.username == user.username) == undefined) {
                            globalSkills.find(obj => obj.name == userSkill.name).offers.push({
                                username: user.username,
                                location: user.location,
                                teachingDay: user.teachingDay,
                                teachingTime: user.teachingTime,
                                achievedPoint: userSkill.achievedPoint,
                            });
                        } else globalSkill.offers.find(obj => obj.username == user.username).achievedPoint = userSkill.achievedPoint;
                    } else {
                        if (globalSkill.offers.find(obj => obj.username == user.username) != undefined) {
                            globalSkills.find(obj => obj.name == userSkill.name).offers = globalSkill.offers.filter(obj => obj.username != user.username);
                        }
                    }
                }
			});

			globalSkills.forEach(function (skill) {
				skill.save(function (err) {if (err) throw err;});
			});
		}

		user.save(function (err) {if (err) throw err;});

		res.json({
			success: true,
		});
	}
});


//drops the offers from global skills. Needed if we delete users
setRoute.post('/dropoffers', async function (req, res) {
	Skill.find({} , (err, skills) => {
        if(err) console.log("error");

        skills.map(skill => {
			skill.offers = [];

			skill.save(  function (err) {if (err) throw err;} );
        })
	})


});

//API call for request onclick
setRoute.post('/request', async function (req, res){

	var user = await User.findOne({username: req.decoded.username}, function(err, user) {
		if (err) throw err;
		return user;
	});

	var skill = await Skill.findOne({name: req.body.name},  function (err, skill) {
		if (err) throw err;
		return skill;
	});

	if (skill !== undefined) {
		var userskill = user.skills.find(obj => obj.name == skill.name);

		if(req.body.requestType == "beginner")
		{
			if(skill.beginnerRequests.find(obj => obj.username == user.username) == undefined)
			{
				skill.beginnerRequests.push({	username: user.username,
										achievedPoint: userskill.achievedPoint,
										email: user.email  });

				skill.save(function (err) {if (err) throw err;});



				res.json({
					succes: true,
					message: 'Added request.',
					sumRequest: skill.beginnerRequests.length
				});
			}
			else
			{


				res.json({
					succes: false,
					message: 'Already requested.',
					sumRequest: skill.beginnerRequests.length
				});
			}
		}

		if(req.body.requestType == "intermediate")
		{
			if(skill.intermediateRequests.find(obj => obj.username == user.username) == undefined)
			{
				skill.intermediateRequests.push({	username: user.username,
										achievedPoint: userskill.achievedPoint,
										email: user.email  });

				skill.save(function (err) {if (err) throw err;});



				res.json({
					succes: true,
					message: 'Added request.',
					sumRequest: skill.intermediateRequests.length
				});
			}
			else
			{


				res.json({
					succes: false,
					message: 'Already requested.',
					sumRequest: skill.intermediateRequests.length
				});
			}
		}

		if(req.body.requestType == "advanced")
		{
			if(skill.advancedRequests.find(obj => obj.username == user.username) == undefined)
			{
				skill.advancedRequests.push({	username: user.username,
										achievedPoint: userskill.achievedPoint,
										email: user.email  });

				skill.save(function (err) {if (err) throw err;});



				res.json({
					succes: true,
					message: 'Added request.',
					sumRequest: skill.advancedRequests.length
				});
			}
			else
			{


				res.json({
					succes: false,
					message: 'Already requested.',
					sumRequest: skill.advancedRequests.length
				});
			}
		}


	}
	else
	{
		res.json({
			succes: false,
			message: "Skill not found"
		});
	}

});

setRoute.post('/endorse', async function (req, res) {
	var data = req.body;

    var user = await User.findOne({
        username: data.username//req.decoded.username
    }, function(err, user) {
        if (err) throw err;
		return user;
    });

	if (!user) {
		res.json({
			success: false,
			message: 'User not found.'
		});
	} else {
        if (user.skills.find(obj => obj.name == data.skillName).endorsement == undefined) user.skills.find(obj => obj.name == data.skillName).endorsement = [];

		if (user.skills.find(obj => obj.name == data.skillName).endorsement.find(obj => obj == req.decoded.username) == undefined) {
            user.skills.find(obj => obj.name == data.skillName).endorsement.push(req.decoded.username);

            user.save(function (err) {if (err) throw err;});
        }
	}
});

const httpServer = http.createServer(app);
httpServer.listen(3000);
