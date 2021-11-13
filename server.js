import express from "express";
import bcrypt from "bcrypt";
import cors from "cors";
import knex from 'knex';

const db = knex({
	client: 'pg',
	connection: {
	  connectionString : process.env.DATABASE_URL,
	  ssl: true
	}
});

const app = express();

// middlewares
app.use(express.json());
app.use(cors({
	origin: "*"
}))

app.get("/", (req, res) => {
	res.send("it is working");
})

// user signin
app.post("/signin", (req, res) => {
	db.select('email', 'hash').from('login')
		.where('email', '=', req.body.email)
		.then(data => {
			const isValid = bcrypt.compareSync(req.body.password, data[0].hash);
			if(isValid) {
				return db.select('*').from('users').where('email', '=', req.body.email)
				.then(user => {
					res.json(user[0]);
				})
				.catch(err => res.status(400).json("Unable to get user"))
			} else {
				res.status(400).json('Wrong information provided');
			}
		})
		.catch(err => res.status(400).json("Unable to get user"))
})

// register a user
// dependency injections
app.post("/register", (req, res) => {
	const {name, email, password} = req.body;
	console.log(name);
	if(!name || !email || !password) {
		return res.status(400).send("Incorrect form submission");
	}
	const hash = bcrypt.hashSync(password, 10);
	// transaction allows to either complete whole or none
	db.transaction(trx => {
		// trx is acting as db
		trx.insert({
			hash: hash,
			email: email
		})
		.into('login')
		.returning('email')
		.then(loginEmail => {
			return trx('users')
			.returning('*')
			.insert({
				email: loginEmail[0],
				name: name,
				joined: new Date()
			})
			.then(user => res.json(user[0]))
			.catch(err => res.status(400).json("Unable to register"));
		})
		.then(trx.commit)
		.catch(trx.rollback);
	})
	.catch(err => res.status(400).json("Unable to store info"))
})

// user profile
app.get("/profile/:id", (req, res) => {
	const {id} = req.params; // destructuring
	db.select('*').from('users').where({id})
		.then(user => {
			if(user.length) {
				res.json(user[0]);
			} else {
				res.status(404).json("No such user found");		
			}
		})
})

// image count
app.put("/image", (req, res) => {
	const {id} = req.body;
	db('users').where('id', '=', id)
		.increment('entries', 1)
		.returning('entries')
		.then(entries => res.json(entries[0]))
		.catch(err => res.status(400).json('Unable to get entries'));
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is started at ${process.env.PORT}`);
})