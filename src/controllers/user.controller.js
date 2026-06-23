import {asyncHandler} from "../utils//asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"   //User can directly communicate with the mongoDB
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { application } from "express"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"


const generateAccessAndRefreshTokens = async(userId)=>{
    try {
        const user =  await User.findById(userId)
        //console.log(user);
        
        const accessToken=user.generateAccessToken()
        //console.log(accessToken);
        
        const refreshToken=user.generateRefreshToken()
        //console.log("refreshToken is here",refreshToken);
        

        //putting refresh token in database
        user.refreshToken=refreshToken
        await user.save({validateBeforeSave:false})  //while saving the models triggered and thus might ask for the validity but i know what am i doing so i jump off those validation

        return {accessToken,refreshToken}

    } catch (error) {
        console.log(error)
        throw new ApiError(500,"Something went wrong while generating access and refresh token")
    }
}

const registerUser = asyncHandler (async (req,res) => {
    // res.status(200).json({
    //     message:"chai aur code"
    // })
    // console.log("Controller reached")

    //before writing the controller it is good practice to write the steps 

    //get user details from backend
    //validation -- not empty
    //check if user already exists:username , email
    //check for images,check for avatar
    //upload them to cloudinary , avatar
    //create user object - create entry in db
    //remove password and refresh token field from response
    //check for user reaction
    //return res

    const {fullName,email,username,password} = req.body
    //console.log("email:",email);

    // if(fullName === ""){
    //     throw new ApiError(400,"fullname is required")
    // }       --  we can check for each field similarly with the if block but we have an alternate

    if(
        [fullName,email,username,password].some((field) => field?.trim() === "")
    ){
        throw new ApiError(400,"All fields are required")
    }

    //User.findOne({email})  -- we can check with this for the existing user but we write it in better way
    const existedUser=await User.findOne({
        $or:[{username},{email}]  //here we can write as many field as we want
    })

    if(existedUser){
        throw new ApiError(409,"User with email or username already exists")
    }

    //req.body(by express) -- gives us most of the data
    //req.files (by multer middleware) -- gives us the access of the file

    const avatarLocalPath=req.files?.avatar[0]?.path;   //localpath because it is on our server not on the cloudinary
    //const coverImageLocalPath=req.files?.coverImage[0]?.path;  //this throws error if we send data without the coverimage although the coverimage is not required field but here we check conditionally and we still cant check conditionally from the undefined


    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
        coverImageLocalPath=req.files.coverImage[0].path
    }

    //console.log(req.files)
    //console.log(req.body)

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required")
    }
    //console.log(avatarLocalPath);
    //console.log(coverImageLocalPath);

    const avatar=await uploadOnCloudinary(avatarLocalPath) //this await is the reason we made this with the async
    const coverImage=await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400,"Avatar file is required")
    }

    const user = await User.create({   //2 rules of db , error handles with catch exist in the asynchandler util and we put await as this can take time
        fullName,
        avatar:avatar.url,
        coverImage:coverImage?.url||"",  //as we dont compulsory to upload coverimage so url may not be exist thereby we enter its url if exist
        email,
        password,
        username:username.toLowerCase()
    })

    const createdUser=await User.findById(user._id).select(
        "-password -refreshToken"    //take care of syntax here
    )

    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registered Successfully")
    )

})

const loginUser = asyncHandler(async (req,res) =>{
    //steps for this controller

    //req body -> gives data
    //access on basis of username or email
    //find the user
    //password check 
    //access token and refresh token generate 
    //send cookie

    const {email,username,password} = req.body
    //console.log(req.body)
    if(!(username || email)){
        throw new ApiError(400,"username or password is required")
    }

    const user = await User.findOne({
        $or : [{username},{email}]
    })

    if(!user){
        throw new ApiError(404,"User does not exist")
    }
    //console.log(password);
    
    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401,"Invalid user credentials")
    }

    //generating the access token -- it is common task so creating a separate method for this
    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)

    //send these tokens in secure cookie to user
    const loggedInUser = await User.findById(user._id).
    select("-password -refreshToken")

    const options = {
        httpOnly: true, 
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser,accessToken,
                refreshToken
            },
            "User loggid In Successfully"
        )
    )


})

const logoutUser = asyncHandler(async(req,res) =>{
    //remove cookie and remove tokens
    //for this controller we create our custom middleware
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined
            }
        },
        {
            new:true
        }
    )

    const options = {
        httpOnly: true, 
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User logged Out"))
})

//lets create a controller to generate the new access token 

const refreshAccessToken = asyncHandler(async (req,res) => {
    //console.log("1")
    //console.log(req.cookies);
    //console.log(req.body);
    const incomingRefreshToken = req.cookies.refreshToken || req.body?.refreshToken
    //console.log(incomingRefreshToken)

    if(!incomingRefreshToken){
        throw new ApiError(401,"unauthorised request")
    }

    try {
        const decodedToken = jwt.verify(         //thid method encodes the user token
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )

        const user = await User.findById(decodedToken?._id)

        if(!user){
            throw new ApiError(401,"Invalid refresh token")
        }
        //console.log("jello");
        
        //console.log("user is here",user);
        
        if(incomingRefreshToken!==user?.refreshToken){
            throw new ApiError(401,"Refresh token is expired or used")
        }

        const options = {
            httpOnly: true,
            secure: true
        }

        const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)

        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    accessToken, refreshToken: newRefreshToken
                },
                "Access Token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async (req,res) => {
    const {oldPassword,newPassword} = req.body

    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid old password")
    }

    user.password = newPassword   //here we only save the new password for the user but not update in the database
    await user.save({validateBeforeSave: false})    //here we finally save the new password in the database and we dont want to validate the other fields as we are only changing the password so we put this option

    return res
    .status(200)
    .json(new ApiResponse(200,{},"Password updated successfully"))
})

const getCurrentUser = asyncHandler(async (req,res) => {
    return res.status(200).json(
        new ApiResponse(200,{user:req.user},"Current user fetched successfully")
    )
})

const updateAccountDetails = asyncHandler(async (req,res) => {
    const {fullName,email} = req.body
    if(!fullName || !email){
        throw new ApiError(400,"All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email
            }
        },
        {new: true}
    ).select("-password")

    return res.status(200).json(
        new ApiResponse(200,{user},"Account details updated successfully")
    )
})

const updateUserAvatar = asyncHandler(async(req,res) => {
    const avatarLocalPath = req.files?.path

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400,"Error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            },
            
        },
        {
            new:true
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200,user,"Avatar image updated successfully")
    )
})


const updateUserCoverImage = asyncHandler(async(req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is missing")
    }


    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on avatar")
        
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Cover image updated successfully")
    )
})

const getUserChannelProfile = asyncHandler(async(req,res) => {
    const {username} = req.params

    if(!username?.trim()){
        throw new ApiError(400,"username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username:username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from:"subscriptions",      //it is to get the subcribers of this user
                localField:"_id",
                foreignField:"channel",
                as:"subscibers"
           }
        },
        {
            $lookup:{
                from:"subscriptions",       //it is to get the channels to whom the user subscibered
                localField:"_id",
                foreignField:"subscriber",
                as:"subscribedTo"
            }
        },
        {
            $addFields:{
                subscribersCount:{
                    $size:"$subscribers"   //it calculates the document to evaluate the no of subscribers of the user
                },
                channelsSubscribedToCount:{
                    $size:"$subscribedTo"  //it calculates the documents to evaluate the no of channels to whom user subscribed
                },
                isSubscribed:{
                    $cond:{
                        if:{$in:[req.user?._id,"$subscribers.subscriber"]},   //it is to evaluate the whether to show the subscibe button or subscribed button
                        then:true,
                        else:false
                    }
                }
            }
        },
        {
            $project:{         //this aggregation pipeline is to select which fields to show at the userprofile 
                fullName:1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404,"channel doet not exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,channel[0],"User channel fetched successfully")
    )
})

const getWatchHistory = asyncHandler(async(req,res) => {
    const user = await User.aggregate([
        {
            $match:{
                _id:new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline:[      //we are writing this subpipeline to get the owner details as well
                    {
                        $lookup:{ 
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[     //this subpipeline to declare what data to be send under the owner details
                                {
                                    $project:{
                                        fullName:1,
                                        username:1,
                                        avatar:1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{    //this is send only the first object from the array this is for the ease of frontend developer
                            owner:{
                                $first:"$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )
})


export default registerUser
export {
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}