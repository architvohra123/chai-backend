import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import User from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";


const generateAccessAndRefreshTokens = async(userId) => {
    try{
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })
        
        return {accessToken, refreshToken}

    }catch(error){
        throw new ApiError(500, "Something went wrong while generating access and refresh tokens")
    }
}

//create register user
const registerUser = asyncHandler( async (req, res) => {
    // get user details from frontend
    // validation of user input - not empty
    // check if user already exist: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return response
 

    const {fullName, email, username, password} = req.body
    console.log(fullName," ", email," ");

    // beginner approach for handling validation of input
    // if(fullName === ""){
    //     throw new ApiError(400, "fullName is required")
    // }

    if (
        [fullName, email, username, password].some(field => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required");
    }    

    //check if there is already that email or username
    const existedUser = await User.findOne({
        $or: [{ email }, { username }]
    })
    if(existedUser){
        throw new ApiError(409, "account already exists")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if(!avatarLocalPath) throw new ApiError(400, "Avatar file is required")
    
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400, "Avatar file is required")
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()     
    })

    //to check if user is created in database
    const createdUser = await User.findById(user._id).select(
        //sspecify what not to select
        "-password -refreshToken"
    )
    
    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )

})

////////////////////////////////////////////////
// create login user

const loginUser = asyncHandler( async (req, res) => {
    // get input from req body
    // username or email
    // find the user
    // password check
    //access and refresh tokens are generated
    //send cookie
    

    const {email, username, password} = req.body

    if(!username || !email){
        throw new ApiError(400, "username or email is required")
    }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })
    if(!user){
        throw new ApiError(404, "User does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password);
    if(!isPasswordValid){
        throw new ApiError(401, "Password is incorrect")
    }

    //  generate the 2 tokens
    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    //send cookies
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "user logged in successfully"
        )
    )
})

////////////////////////////////////////////////
// logout the user

const logoutUser = asyncHandler( async (req, res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged Out"))

})


export {
    registerUser,
    loginUser,
    logoutUser
}