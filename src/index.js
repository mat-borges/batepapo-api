import * as dotenv from 'dotenv';

import { strict as assert } from 'assert';
import cors from 'cors';
import dayjs from 'dayjs';
import express from 'express';
import { stripHtml } from 'string-strip-html';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.post('/participants', (req, res) => {
	const { username: name } = req.body;
	// this validation must be done with joi
	if (!username) {
		res.sendStatus(422);
	}
	// conditional checking if there's already an user with the same name
	// the next infos must be saved using mongodb
	const user = { name: `${username}`, lastStatus: Date.now() };
	const message = {
		from: `${username}`,
		to: 'Todos',
		text: 'entra na sala...',
		type: 'status',
		time: dayjs(user.lastStatus, 'HH:mm:ss'),
	};
	res.sendStatus(201);
});

app.get('/participants', (req, res) => {
	//get participants from mongodb and return it to the user
	console.log('get PARTICIPANTS');
});

app.post('/messages', (req, res) => {
	console.log('post Messages');
	res.sendStatus(201);
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

app.listen(5000, () => console.log('Running server on http://localhost:5000'));
