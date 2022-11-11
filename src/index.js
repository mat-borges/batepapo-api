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

// Joi Schemas
const messageSchema = Joi.object({
	from: Joi.string().alphanum().required(),
	to: Joi.string().alphanum().required(),
	text: Joi.string().required(),
	type: Joi.string().valid('message', 'private_message').required(),
	time: Joi.string().required(),
});
const participantSchema = Joi.object({
	name: Joi.string().alphanum().required(),
	lastStatus: Joi.number().required(),
});

// start mongo
try {
	await mongoClient.connect();
	db = mongoClient.db('batepapoUolApi');
	participants = db.collection('participants');
	messages = db.collection('messages');
} catch (err) {
	res.status(500).send({ message: err.message });
}

// Routes
app.post('/participants', async (req, res) => {
	const username = cleanStringData(req.body.name);
	const { error, value: user } = participantSchema.validate(
		{
			name: username,
			lastStatus: Date.now(),
		},
		{ abortEarly: false }
	);

	if (error) {
		const errors = error.details.map((detail) => detail.message);
		res.status(422).send({ message: errors });
		return;
	}

	try {
		const message = {
			from: username,
			to: 'Todos',
			text: 'entra na sala...',
			type: 'status',
			time: dayjs(user.lastStatus).format('HH:mm:ss'),
		};
		const participant = await participants.findOne({ name: username });

		if (!participant) {
			await participants.insertOne(user);
			await messages.insertOne(message);
			res.status(201).send({ message: 'User created' });
		} else {
			res.status(409).send({ message: 'A user with this name already exists' });
		}
	} catch (err) {
		console.log(err);
		res.status(500).send({ message: err.message });
	}
});

app.get('/participants', async (req, res) => {
	try {
		const getParticipants = await participants.find().toArray();

		if (getParticipants.length === 0) {
			res.status(404).send({ message: 'There are no users online' });
			return;
		}

		res.status(200).send(getParticipants);
	} catch (err) {
		console.log(err);
		res.status(500).send({ message: err.message });
	}
});

app.post('/messages', async (req, res) => {
	const { to, text, type } = req.body;
	const username = cleanStringData(req.headers.user);
	const { error, value: message } = messageSchema.validate(
		{
			from: username,
			to: cleanStringData(to),
			text: cleanStringData(text),
			type: cleanStringData(type),
			time: cleanStringData(dayjs().format('HH:mm:ss')),
		},
		{ abortEarly: false }
	);
	if (error) {
		const errors = error.details.map((detail) => detail.message);
		res.status(422).send({ message: errors });
		return;
	}

	try {
		const participant = await participants.findOne({ name: username });
		if (!participant) {
			res.status(422).send({ message: "There's no user with this username" });
		} else {
			await messages.insertOne(message);
			res.status(201).send({ message: 'Message created' });
		}
	} catch (err) {
		console.log(err);
		res.status(500).send({ message: err.message });
	}
});

app.get('/messages', async (req, res) => {
	const limit = parseInt(req.query.limit);
	const user = cleanStringData(req.headers.user);
	try {
		const getMessages = await messages.find().toArray();
		const userMessages = getMessages.filter((e) => {
			if (e.to === 'Todos' || e.to === user || e.from === user || e.type === 'message') {
				return true;
			}
		});

		if (!limit) {
			res.status(200).send(userMessages);
		} else {
			res.status(200).send(userMessages.slice(-limit));
		}
	} catch (err) {
		console.log(err);
		res.status(500).send({ message: err.message });
	}
});

app.post('/status', async (req, res) => {
	const user = cleanStringData(req.headers.user);

	try {
		const participant = await participants.findOne({ name: user });

		if (!participant) {
			res.sendStatus(404);
		} else {
			const id = participant._id;
			await participants.updateOne({ _id: id }, { $set: { lastStatus: Date.now() } });
			res.sendStatus(200);
		}
	} catch (err) {
		res.status(500).send({ message: err.message });
	}
});

// setInterval(async () => {
// 	try {
// 		const users = await participants.find().toArray();
// 		const removeUsers = users.filter((p) => Date.now() - p.lastStatus >= 10000);
// 		for (const e of removeUsers) {
// 			const id = e._id;
// 			await participants.deleteOne({ _id: id });
// 			const message = {
// 				from: e.name,
// 				to: 'Todos',
// 				text: 'sai da sala...',
// 				type: 'status',
// 				time: dayjs().format('HH:mm:ss'),
// 			};
// 			await messages.insertOne(message);
// 		}
// 	} catch (err) {
// 		res.status(500).send({ message: err.message });
// 	}
// }, 15000);

app.delete('/messages/:id', async (req, res) => {
	try {
		const user = cleanStringData(req.headers.user);
		const { id } = req.params;
		const message = await messages.findOne({ _id: new ObjectId(id) });

		if (!message) {
			res.sendStatus(404);
		} else if (message.from !== user) {
			res.status(401).send({ message: "You can't delete a message you didn't send" });
		} else {
			await messages.deleteOne({ _id: new ObjectId(id) });
			res.status(200).send({ message: 'Message deleted' });
		}
	} catch (err) {
		res.status(500).send({ message: err.message });
	}
});

app.put('/messages/:id', async (req, res) => {
	const { to, text, type } = req.body;
	const { id } = req.params;
	const user = cleanStringData(req.headers.user);

	try {
		const participant = await participants.findOne({ name: user });

		if (!participant) {
			res.status(422).send({ message: "There's no user with this username" });
		} else {
			const message = await messages.findOne({ _id: new ObjectId(id) });

			if (!message) {
				res.sendStatus(404);
			} else if (message.from !== user) {
				res.sendStatus(401);
			} else {
				const { error, value: messageEdit } = messageSchema.validate({
					from: cleanStringData(message.from),
					to: cleanStringData(to),
					text: cleanStringData(text),
					type: cleanStringData(type),
					time: cleanStringData(message.time),
				});
				if (error) {
					res.status(422).send({ messsage: error.message });
					return;
				}

				await messages.updateOne({ _id: new ObjectId(id) }, { $set: messageEdit });
				res.status(200).send({ message: 'Message edited' });
			}
		}
	} catch (err) {
		res.status(500).send({ message: err.message });
	}
});

// Port
app.listen(process.env.PORT, () => console.log(`Running server on http://localhost:${process.env.PORT}`));
