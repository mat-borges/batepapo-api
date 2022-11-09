import express, { json } from 'express';

import { MongoClient } from 'mongodb';
import cors from 'cors';
import dayjs from 'dayjs';
import dotenv from 'dotenv';

// import { strict as assert } from 'assert';
// import { stripHtml } from 'string-strip-html';

dotenv.config();

const app = express();
app.use(cors());
app.use(json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
let participants;
let messages;

mongoClient.connect().then(() => {
	db = mongoClient.db('batepapoUolApi'); //O padrão é test
	participants = db.collection('participants');
	messages = db.collection('messages');
});

app.post('/participants', (req, res) => {
	const { name: username } = req.body;
	// this validation must be done with joi
	if (!username) {
		res.sendStatus(422);
	}
	// conditional checking if there's already an user with the same name using joi
	const user = { name: `${username}`, lastStatus: Date.now() };

	const message = {
		from: `${username}`,
		to: 'Todos',
		text: 'entra na sala...',
		type: 'status',
		time: dayjs(user.lastStatus).format('HH:mm:ss'),
	};

	participants.insertOne(user).then(() => {
		messages.insertOne(message).then(() => {
			res.sendStatus(201);
		});
	});
});

app.get('/participants', (req, res) => {
	//get participants from mongodb and return it to the user
	participants
		.find()
		.toArray()
		.then((participants) => {
			res.status(200).send(participants);
		});
});

app.post('/messages', (req, res) => {
	const { to, text, type } = req.body;
	const message = {
		from: req.headers.user,
		to,
		text,
		type,
		time: dayjs().format('HH:mm:ss'),
	};

	messages.insertOne(message).then(() => {
		res.sendStatus(201);
	});
});

app.get('/messages', (req, res) => {
	console.log('get Messages');
});

app.post('/status', (req, res) => {
	console.log('post Status');
});

app.delete('/messages/:id', (req, res) => {
	console.log('delete Messages');
});

app.put('/messages/:id', (req, res) => {
	console.log('put Messages');
});

app.listen(process.env.PORT, () => console.log('Running server on http://localhost:5000'));
