import express, { json } from 'express';

import { MongoClient } from 'mongodb';
import cors from 'cors';
import dayjs from 'dayjs';
import dotenv from 'dotenv';
import { stripHtml } from 'string-strip-html';

dotenv.config();

const app = express();
app.use(cors());
app.use(json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
let participants;
let messages;
const cleanStringData = (string) => stripHtml(string).result.trim();

mongoClient.connect().then(() => {
	db = mongoClient.db('batepapoUolApi'); //O padrão é test
	participants = db.collection('participants');
	messages = db.collection('messages');
});

app.post('/participants', (req, res) => {
	const { name } = req.body;
	const username = cleanStringData(name);
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
		from: cleanStringData(req.headers.user),
		to: cleanStringData(to),
		text: cleanStringData(text),
		type: cleanStringData(type),
		time: dayjs().format('HH:mm:ss'),
	};

	messages.insertOne(message).then(() => {
		res.sendStatus(201);
	});
});

app.get('/messages', (req, res) => {
	const limit = parseInt(req.query.limit);
	const user = cleanStringData(req.headers.user);

	messages
		.find()
		.toArray()
		.then((messages) => {
			const userMessages = messages.filter((e) => {
				if (e.to === 'Todos' || e.to === user || e.from === user) {
					return true;
				}
			});
			console.log(userMessages);
			if (!limit) {
				res.status(200).send(userMessages);
			} else {
				res.status(200).send(userMessages.slice(-limit));
			}
		});
});

app.post('/status', (req, res) => {
	const user = cleanStringData(req.headers.user);

	participants
		.find({ name: user })
		.toArray()
		.then((participant) => {
			if (participant.length === 0) {
				res.sendStatus(404);
			} else {
				const id = participant[0]._id;
				participants.updateOne({ _id: id }, { $set: { lastStatus: Date.now() } }).then(() => {
					res.sendStatus(200);
				});
			}
		});
});

// setInterval(() => {
// 	participants
// 		.find()
// 		.toArray()
// 		.then((usersArray) => {
// 			const removeParticipants = usersArray.filter((p) => Date.now() - p.lastStatus >= 10000);
// 			removeParticipants.forEach((e) => {
// 				const id = e._id;
// 				participants.deleteOne({ _id: id }).then(() => {
// 					const message = {
// 						from: e.name,
// 						to: 'Todos',
// 						text: 'sai da sala...',
// 						type: 'status',
// 						time: dayjs().format('HH:mm:ss'),
// 					};
// 					messages.insertOne(message);
// 				});
// 			});
// 		});
// }, 15000);

// app.delete('/messages/:id', (req, res) => {
// 	console.log('delete Messages');
// });

// app.put('/messages/:id', (req, res) => {
// 	console.log('put Messages');
// });

app.listen(process.env.PORT, () => console.log('Running server on http://localhost:5000'));
