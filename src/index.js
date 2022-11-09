import { MongoClient, ObjectId } from 'mongodb';
import express, { json } from 'express';

import Joi from 'joi';
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
	db = mongoClient.db('batepapoUolApi');
	participants = db.collection('participants');
	messages = db.collection('messages');
});

const messageSchema = Joi.object({
	from: Joi.string(),
	to: Joi.string().min(1),
	text: Joi.string().min(1),
	type: Joi.string().valid('message', 'private-message'),
	time: Joi.string(),
});
const participantSchema = Joi.object({ name: Joi.string().alphanum().min(1), lastStatus: Joi.number() });

app.post('/participants', (req, res) => {
	const { name } = req.body;
	const username = cleanStringData(name);

	const { error, value: user } = participantSchema.validate({ name: `${username}`, lastStatus: Date.now() });

	if (error) {
		res.status(422).send(error.message);
	} else {
		const message = {
			from: `${username}`,
			to: 'Todos',
			text: 'entra na sala...',
			type: 'status',
			time: dayjs(user.lastStatus).format('HH:mm:ss'),
		};

		participants
			.find({ name: username })
			.toArray()
			.then((participant) => {
				if (participant.length === 0) {
					participants.insertOne(user).then(() => {
						messages.insertOne(message).then(() => {
							res.sendStatus(201);
						});
					});
				} else {
					res.status(409).send('A user with this username already exists');
				}
			});
	}
});

app.get('/participants', (req, res) => {
	participants
		.find()
		.toArray()
		.then((participants) => {
			res.status(200).send(participants);
		});
});

app.post('/messages', (req, res) => {
	const { to, text, type } = req.body;
	const username = cleanStringData(req.headers.user);
	const { error, value: message } = messageSchema.validate({
		from: username,
		to: cleanStringData(to),
		text: cleanStringData(text),
		type: cleanStringData(type),
		time: dayjs().format('HH:mm:ss'),
	});

	if (error) {
		res.status(422).send(error.message);
	} else {
		participants
			.find({ name: username })
			.toArray()
			.then((participant) => {
				if (participant.length === 0) {
					res.status(422).send("There's no user with this username");
				} else {
					messages.insertOne(message).then(() => {
						res.sendStatus(201);
					});
				}
			});
	}
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

setInterval(() => {
	participants
		.find()
		.toArray()
		.then((usersArray) => {
			const removeParticipants = usersArray.filter((p) => Date.now() - p.lastStatus >= 10000);
			removeParticipants.forEach((e) => {
				const id = e._id;
				participants.deleteOne({ _id: id }).then(() => {
					const message = {
						from: e.name,
						to: 'Todos',
						text: 'sai da sala...',
						type: 'status',
						time: dayjs().format('HH:mm:ss'),
					};
					messages.insertOne(message);
				});
			});
		});
}, 15000);

app.delete('/messages/:id', (req, res) => {
	const user = cleanStringData(req.headers.user);
	const { id } = req.params;
	messages
		.find({ _id: ObjectId(id) })
		.toArray()
		.then((messagesArray) => {
			if (messagesArray.length === 0) {
				res.sendStatus(404);
			} else if (messagesArray[0].from !== user) {
				res.sendStatus(401);
			} else {
				messages.deleteOne({ _id: ObjectId(id) }).then(() => {
					res.sendStatus(200);
				});
			}
		});
});

app.put('/messages/:id', (req, res) => {
	const { to, text, type } = req.body;
	const { id } = req.params;
	const user = cleanStringData(req.headers.user);
	const { error, value } = messageSchema.validate({ to, text, type });

	if (error) {
		res.status(422).send(error.message);
	} else {
		participants
			.find({ name: user })
			.toArray()
			.then((participant) => {
				if (participant.length === 0) {
					res.status(422).send("There's no user with this username");
				} else {
					messages
						.find({ _id: ObjectId(id) })
						.toArray()
						.then((messagesArray) => {
							if (messagesArray.length === 0) {
								res.sendStatus(404);
							} else if (messagesArray[0].from !== user) {
								res.sendStatus(401);
							} else {
								messages
									.updateOne(
										{ _id: ObjectId(id) },
										{
											$set: {
												to: cleanStringData(to),
												text: cleanStringData(text),
												type: cleanStringData(type),
											},
										}
									)
									.then(() => {
										res.sendStatus(200);
									});
							}
						});
				}
			});
	}
});

app.listen(process.env.PORT, () => console.log(`Running server on http://localhost:${process.env.PORT}`));
