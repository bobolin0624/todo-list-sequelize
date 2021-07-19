const express = require('express')
const exphbs = require('express-handlebars')
const methodOverride = require('method-override')
const bcrypt = require('bcryptjs')
const session = require('express-session')
const usePassport = require('./config/passport')
const passport = require('passport')
const { authenticator } = require('./middleware/auth')
const flash = require('connect-flash')

const app = express()
const PORT = 3000

app.engine('handlebars', exphbs({ defaultLayout: 'main' }))
app.set('view engine', 'handlebars')
app.use(express.urlencoded({ extended: true }))
app.use(methodOverride('_method'))

app.use(session({
  secret: 'ThisIsMyTodoSecret',
  resave: false,
  saveUninitialized: true
}))

usePassport(app)
app.use(flash())

// 先載入資料夾
const db = require('./models')
const auth = require('./middleware/auth')
const Todo = db.Todo
const User = db.User

// 給 handlebars 使用
app.use((req, res, next) => {
  res.locals.isAuthenticated = req.isAuthenticated()
  res.locals.user = req.user
  res.locals.success_msg = req.flash('success_msg')
  res.locals.warning_msg = req.flash('warning_msg')
  res.locals.login_msg = req.flash('login_msg')
  next()
})

// index
app.get('/', authenticator, (req, res) => {
  const userId = req.user.id
  return Todo.findAll({
    where: { UserId: userId },
    raw: true,
    nest: true
  })
    .then((todos) => { return res.render('index', { todos: todos }) })
    .catch(error => { return res.status(422).json(error) })
})

// CREATE
app.get('/todos/new', authenticator, (req, res) => {
  res.render('new')
})

app.post('/todos', authenticator, (req, res) => {
  const { name } = req.body
  const userId = req.user.id
  return Todo.create({
    name,
    UserId: userId
  })
    .then(() => res.redirect('/'))
    .catch((error) => console.log(error))
})

// READ : detail view
app.get('/todos/:id', authenticator, (req, res) => {
  const id = req.params.id
  return Todo.findByPk(id)
    // 轉換成 plain object  => toJSON()
    .then(todo => res.render('detail', { todo: todo.toJSON() }))
    .catch(error => console.log(error))
})

// Update : edit view
app.get('/todos/:id/edit', authenticator, (req, res) => {
  const id = req.params.id
  const UserId = req.user.id
  // find id from todo and belong to this user
  return Todo.findOne({ where: { id, UserId } })
    .then(todo => res.render('edit', { todo: todo.toJSON() }))
    .catch(error => console.log(error))
})

app.put('/todos/:id', authenticator, (req, res) => {
  const { name, isDone } = req.body
  const UserId = req.user.id
  const id = req.params.id
  return Todo.findOne({ where: { id, UserId } })
    .then(todo => {
      todo.name = name
      // if (isDone === 'on') { todo.isDone = true } 
      // else { todo.isDone = false }
      todo.isDone = isDone === 'on'
      return todo.save()
    })
    .then(() => res.redirect('/'))
    .catch(error => console.log(error))
})

//　Delete
app.delete('/todos/:id', authenticator, (req, res) => {
  const UserId = req.user.id
  const id = req.params.id
  return Todo.findOne({ where: { id, UserId } })
    .then(todo => todo.destroy())
    .then(() => res.redirect('/'))
    .catch(error => console.log(error))
})

// login
app.get('/users/login', (req, res) => {
  res.render('login')
})

app.post('/users/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/users/login',
  failureFlash: true
}))

// register
app.get('/users/register', (req, res) => {
  res.render('register')
})

app.post('/users/register', (req, res) => {
  const { name, email, password, confirmPassword } = req.body
  const errorMessages = []
  if (!name || !email || !password || !confirmPassword) {
    errorMessages.push({ message: 'All fields are required!'})
  }
  if (password !== confirmPassword) {
    errorMessages.push({ message: 'Password and Confirm Password do not match!'})
  }
  if (errorMessages.length) {
    return res.render('register', { name, email, password, confirmPassword, errorMessages })
  }
  User.findOne({ where: { email } })
    .then(user => {
      if (user) {
        errorMessages.push({ message: 'User already exists.'})
        return res.render('register', { name, email, password, confirmPassword, errorMessages })
      }
      return bcrypt
        .genSalt(10)
        .then(salt => bcrypt.hash(password, salt))
        .then(hash => User.create({
          name,
          email,
          password: hash
        }))
        .then(() => res.redirect('/'))
        .catch(error => console.log(error))
    })
})

// logout
app.get('/users/logout', (req, res) => {
  req.logOut()
  req.flash('success_msg', 'Logout successful!')
  res.redirect('/users/login')
})

app.listen(PORT, () => {
  console.log(`App is running on http:localhost/${PORT}`)
})