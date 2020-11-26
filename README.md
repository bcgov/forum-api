# OCWA Forum API
## Installation

All installs require an instance of mongodb available.

### Prerequisites

- npm 6.4.1 or newer
- node 10.15.1 LTS or newer
- MongoDB 4.0 or newer
- Docker 18.09.1 or newer

### Bare Metal Install
#### MongoDB
Create a new Mongo collection on the command line. The following value `commentApi` is provided for (local development only) all of user, password and database name.
Whatever values are chosen need to be the *same* in both the creation of the Mongo Collection (see below) and in the database entry for `config/default.json` (see [Create and Modify Config](#create-and-modify-config))
```
mongo
db.createCollection("commentApi")
use commentApi
db.createUser({user:"commentApi", pwd:"commentApi", roles:["dbAdmin", "readWrite"]}) 
exit
```

Test the connection to the MongoDB Collection you just made (successful test brings you to a command prompt): 
`mongo mongodb://commentApi:commentApi@localhost:27017/commentApi?authSource=commentApi`

#### Create and Modify Config 
Create a default.json file from default.json.example under the config directory and edit the values to ones for your environment.
`cp config/default.json.example config/default.json`
run `npm install` to install dependencies and then `npm run serve` to start up the server.

### Docker Install
Run `docker build . -t ocwa_forum_api` to build the docker container and the following commands to run it
Replace the configuration values below as necessary, for example, you can replace `$apiport:3000` and `$wsport:2999` with the ports you want the api and websocket on locally.

``` sh
hostip=$(ifconfig en0 | awk '$1 == "inet" {print $2}')
docker run -e EMAIL_FIELD=Email -e GIVENNAME_FIELD=GivenName -e SURNAME_FIELD=Surname -e GROUP_FIELD=Groups -e JWT_SECRET=MySecret\
           -e DEFAULT_ACCESS_IS_GROUP=true -e REQUIRED_CREATE_ROLE=exporter -e LOG_LEVEL=info -e DB_USERNAME=mongoUser \
           -e DB_PASSWORD=mongoPassword -e DB_NAME=mongoDbName -e USER_ID_FIELD=Email  -e DB_HOST=docker \
           -e IGNORE_GROUPS="\"group1\", \"group2\"" -e ADMIN_GROUP=\"admin\"" \
           -e EMAIL_SUBJECT=forumApi -e EMAIL_ENABLED=false -e EMAIL_USER=forum@ocwa.com -e EMAIL_PASSWORD=MYPASS -e EMAIL_FROM=forum@ocwa.com \
           -e EMAIL_SERVICE=smtp.gmail.com -e EMAIL_PORT=465 -e EMAIL_SECURE=true \
           --add-host=docker:$hostip -p $apiport:3000 -p $wsport:2999 ocwa_forum_api
```

To change the email template override (either directly or through a docker volume mount), modify `notifications/emailTemplate.html`

## Helm

For both below helm commands make a copy of values.yaml within the helm/forum-api directory
and modify it to contain the values specific for your Kubernetes deployment.

`cp helm/forum-api/values.yaml helm/forum-api/config.yaml`

### Helm Install (Kubernetes)

``` sh
helm install --name ocwa-forum-api --namespace ocwa ./helm/forum-api -f ./helm/forum-api/config.yaml
```

### Helm Update (Kubernetes)

``` sh
helm upgrade --name ocwa-forum-api ./helm/forum-api  -f ./helm/forum-api/config.yaml
```

## Test

``` sh
npm test
```
