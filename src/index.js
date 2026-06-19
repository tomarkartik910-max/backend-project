import dns from 'dns';        //this is the line of code which helps to solve my error (which lasts for 1 day)

dns.setServers([
  '1.1.1.1',
  '8.8.8.8'
]);




// require('dotenv').config({path: './env'})--one way to configure dotenv (code works fine with this statement only but it spoils the consistency of the code so we write another method to configure dotenv which also dont spoils the consistency of the code)
import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from './app.js';


dotenv.config({
    path:'./.env'
})





console.log(process.env.MONGODB_URI)
connectDB()       //connectDB is an async function so returns promise so we need to handle the promise using then catch
.then(() => {
    app.listen(process.env.PORT||8000,() => {
        console.log(`Server is running at port : ${process.env.PORT}`);
    })
})
.catch((err) => {
    console.log("MONGODB connection failed !!!",err);
})












//another way to connect to the databse
/*
import mongoose from "mongoose"
import { DB_NAME } from "./constants"

import express from "express"
const app = express()

( async() => {
    try {
        mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error",() => {
            console.log("ERROR: ",error);
            throw error
        })

        app.listen(process.env.PORT,() => {
            console.log(`App is listening on port ${process.env.PORT}`);
        })
    } catch (error) {
        console.error("ERROR: ",error)
        throw error
    }
})()

*/