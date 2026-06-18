import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

const app = express()

app.use(cors({
    origin:process.env.CORS_ORIGIN,
    credentials:true
}))
app.use(express.json({limit:"16kb"}))        //to handle data coming in json format
app.use(express.urlencoded({extended:true,limit:"16kb"}))        //to handle data coming in URL
app.use(express.static("public"))      //to handle the images and videos on the server itself
app.use(cookieParser())   //it is for the middlewares configuration


//routes import

import userRouter from "./routes/user.routes.js"

//routes declaration
app.use("/api/v1/users",userRouter)

//how our URL looks-- http://localhost:3000/api/v1/users/register

export {app}