# fechtbot
(WIP) FechtBot: A Discord Bot to manage turn/phase-based tabletop RPG combat


### Deploying to Heroku


### CLI Method

_Ensure you have [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed_

1. Login to heroku via the CLI

```bash
$ heroku login
```

2. Create a new heroku app

```bash
$ heroku create
```

3. Before pushing to heroku, you need to set up the config variables in other words the env variables you would use locally

    i. Go to Settings -> Reveal Config Vars

    ii. Add the config variables according to the .env.example

    iii. These Include

    ```bash
    DATABASE_UR
	TOKEN
	PREFIX
	NPM_CONFIG_PRODUCTION (Must be false)
    ```

    iv. Ensure that you add NPM_CONFIG_PRODUCTION to false to allow installation of dev dependencies for post build to work correctly

4. Commit any changes and push your code from local repo to your git
```bash
$ git add -A 
$ git commit -m "message here"
$ git push heroku master
```

5. Open the heroku app

```bash
$ heroku open
```

### Github method

_Note: You may also connect your github repo to the heroku and add automatic deployment on push to the github repo_


## Configuration Setup

These configuration setups are necessary for the app to function correctly as intended. These configuration setups will be required to be added as environment variables for the server to make use of.

### Local Environment Variables (.env file)
For development you will need a .env file for environmental variables. This includes:

```bash
DATABASE_URL=mongodb+srv://username:password@clusterURLEg?retryWrites=true
TOKEN=YOUR_DISCORD_BOT_TOKEN
PREFIX=THE_BOT_COMMAND_PREFIX_USED_TYPICALLY_!
```


### MongoDB & Mongo Atlas

A MongoDB URI is needed to connect to a MongoDB connection. The easiest way to do this is to use [Mongo Atlas](https://www.mongodb.com/cloud/atlas). If you'd like to do this locally you can follow the instructions at (https://docs.mongodb.com/manual/installation/)

#### Mongo Atlas

1. Select 'Build a New Cluster' and follow the prompts
2. When the Cluster has been created, click on 'Connect'
3. Choose your connection method, for the purposes of this application we will use 'Connect Your Application'
4. Next you will need to grab this connection string (Standard connection string). This is the URI that will be used as an environment variable
