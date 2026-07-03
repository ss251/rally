# Workshop — "Transaction Abstraction for Better DApp UX" (verbatim transcript)

> **Source of record.** UXmaxx Hackathon workshop (2nd one by Particle), hosted by Encode; speaker: **David Zambiasi**, head of DevRel at Particle Network. Reproduced verbatim from the auto-transcript (timestamps preserved). Do not summarize/edit — accurate reference. Repo shown: https://github.com/soos3d/workshop-demo-02 . Video: https://www.youtube.com/watch?v=UAdWc3WIl3g (⚠️ confirm which video maps to which workshop; see README).

---

0:00 Welcome everyone and thanks for joining us for another session of the UXMax hackathon where the whole mission is pushing crypto towards its potential by
0:09 fixing the thing that holds it back the most user experience. A quick recap of where we are. We've had our launch event
0:16 office hours and a session with arbitrum on supporting founders on Tuesday. And today we get into the first of our
0:22 hands-on technical UX workshops. This session is transaction abstraction for better DAP UX. The core idea, a huge
0:30 amount of crypto friction comes from transactions. You know, confusing signing, gas, clunky flows. Transaction abstraction is how you make your app
0:39 simple and intuitive. We'll cover sponsored transactions, smoother signing flows, and better execution patterns that strip friction away from the user
0:47 journey. This is bang on for the hackathon. If you're building something that people will actually use, this is the stuff that separates a demo from a
0:55 real product. I'm really pleased to introduce our guest David Zambiasi, head of DevRel at Particle Network. He works on exactly this problem day in day out.
1:05 So you're in expert hands. Quick bit of housekeeping, you can drop your question in the chat as we go and we'll take them at the end. And keep this
1:12 session in mind for your builds. It's directly relevant to what the judges want to see. With that, David, straight over to you.
1:21 All right, let's go. Let's go. Uh, thank you very much for the introduction. very very deep. Thank you. Um so welcome
1:28 back. Uh this is the second workshop that I'm doing. Uh we did another one a little bit simpler on the first day on
1:34 launch. Um so just wanted to give a brief recap of kind of what we went
1:41 through the first time. Um the first workshop was hands-on and worked
1:49 and it was useful but it was a very brief demo and it wasn't as deep for the user experience improvements that we are looking for in the hackathon. Uh it was more server side. It was a very brief script just
2:06 kind of showing how the universal accounts and the SDK work. Um, so that was a good starting point, but
2:14 today I wanted to go a little bit deeper. And so what we're going to do in this workshop, I'll show a demo that I put together that is also obviously
2:22 available to you. Um, I'll do just like the last time. I'll link everything at the end in the Discord channel. Uh, in
2:29 this case, we have a real front end. Um obviously this is not a particularly
2:37 let's say complex and successful to be app is a very basic demo where we are
2:45 logging in with email. Uh in this case I'm using the magic wallet. So we'll have an embedded wallet. So we don't have a seed phrase or anything like
2:51 that. and we are going to demonstrate how to use the sign 7702
2:59 authorization from the magic wallet to upgrade that EOA into a universal account. So essentially this
3:08 allows you to upgrade your existing users into a universal account and that means that you can use their current UA
3:16 as a universal account and that means that you can use all the features that chain abstraction offers.
3:23 That essentially means you have a user that has some assets around chains and you can use those assets across
3:32 chains without having to swap, without having to bridge or anything like that.
3:36 This was somewhat of a big limitation before we introduced the 7702 feature because the universal account is still
3:43 is a smart account. That means that if you have a new user, then you need to have the user migrate assets somehow
3:52 before you can access the chain abstraction features. This eliminates that. Um the main caveat really is that
4:01 this 7702 mode only works either server side where you control the private key or with embedded wallets. Um
4:10 not really with RPC browser wallets like MetaMask, OKX, anything like this. Um this is not a limitation on our side. Uh
4:19 this is because browser wallets do not allow the methods to sign the 7702 authorization just for security
4:26 purposes. Um so compared to the previous workshop that we did and basically
4:33 how the universal accounts work there is really only a small change. The main change is that now we initialize the
4:42 universal account from the wallet that comes from magic and not from the private key and we initialize it in 7702
4:51 mode and this is one of the only things that you really need. This is going to be the first step and then the second step is going to be the delegation.
5:03 So how it's going to work? You log in with magic. You have your authentication then you delegate. So to send the
5:11 delegation the delegation is a type four transaction.
5:16 So you need gas for this. How this demo is going to work is I put it up on base.
5:22 So essentially we make the delegation on base from the EOA. So my EOA, my magic
5:29 EOA on base becomes a universal account, right? And that means that now all the assets that I have on base are available
5:39 on all the other chains directly without having to migrate, without having to do anything. So I'm going to
5:46 need some amount of ETH on base to be able to send this delegation. But then after that I can use any assets that I have there to make the transactions.
5:57 In this case the transaction example is going to be a conversion and we are going to convert some of the USDC on
6:04 base that I have on that account into USDC on Solana. Uh one of the benefits of universal accounts is that it also
6:12 unlocks Solana for your app. So let's say that your app mostly works on EVM
6:21 and you implement universal accounts that one account is also going to support Solana. So out of the box you
6:27 unlock Solana as well. Um so as I mentioned this signature cannot be made by MetaMask or browser wallets. Um
6:37 but it can be made most of the embedded wallets support it. And so how it works with magic is that we basically
6:46 select the magic embedded wallet to be on base in this case chain 8453 and
6:53 then we call a method from the universal account SDK. Uh the method is getEIP7702
7:00 [authorization] on base. This is basically just a very basic method that returns the
7:09 authorizations that we are going to have to sign through. Um in this case is this essentially returning the smart
7:16 contract address that we have deployed on base. Uh that is going to be
7:24 delegation right. So this whole code that we see here in the screen we get the EIP7702
7:33 [authorization] then we sign the authorization as you can see with the contract address chain ID and the nonce. So here
7:41 essentially we say upgrade my EOA to this contract address and this contract address is just an instance of the universal account. That's it.
7:53 And then after that we can send a transaction and that's it. It's upgraded. Uh once you have this
8:01 transaction sent through your universal account is available right there directly. Um, one note that I don't
8:10 think I have in the presentation. I do not but it is in the demo and the code. You can remove this delegation
8:18 very easily. So right now you see we authorize our magic wallet to become
8:25 a universal account on base because we sign the authorization to the contract address. especially if you do the
8:32 same but you use the zero address instead of the contract address or instead of the universal account address
8:40 that returns from our SDK then in that case you're going to remove the delegation it is in the code I can show
8:47 it in the demo as well after this you have a universal account and you can use the SDK just as normal so in this demo
8:56 we are essentially create a convert transaction where we take some tokens that we have on our account on base and
9:04 we convert it to Solana and the rest everything works the exact same.
9:11 So this is essentially what you do compared to the previous workshop.
9:18 You add an actual embedded wallet and that's it. you add the wallet and
9:26 then we create the transfer transaction. Oh, sorry here I'm reading the wrong part. Then we create a convert transaction.
9:36 That's it. Um I'll show the code briefly. Actually, let me show the demo first. Um really I
9:45 I'll link the repository because it's easier. But everything in this demo that is relative to the universal
9:52 account in the 7702 part is in this file into source hooks universal
10:00 account provider here basically is where everything happens. So, I'm just going to run the demo.
10:14 And I think you're not going to see here because I have it.
10:28 All right. So, we got the demo right here running. Uh it's a very basic UI but it works.
10:38 So I wanted to demonstrate the whole process. So let me just
10:48 let me just remember which account I used for this.
11:02 Let me see.
11:09 Let me try this one here. So, I'm just going to log in. In this case, I added only a OTP,
11:17 a one time password, email login through magic. Magic
11:24 obviously supports also the social login directly like Google and all those
11:34 let me see past the code save the is the right one and this is
11:41 not the right one because I don't have any funds in it I think it was this other one here I have a wallet with already some funds
11:49 in it otherwise it doesn't work.
11:56 But one thing that I wanted to mention is that in those demos and workshops that I run, it doesn't make as
12:03 much sense probably as at first because I still have to show that I have to fund the wallet. And this is because this is simply a new magic project.
12:16 So all the wallets here are basically going to be empty. So this is kind of
12:24 kind of the downside of these kind of demos. If you have an app that is already running with this kind of infrastructure, then you can just
12:32 make the upgrade and it makes sense right out of the box.
12:37 So now here's how the demo looks like and this is basically the app that you're going to be able to run once
12:44 I give the repository to you. Uh it's very basically just show some information. Then we have a card to
12:52 send the delegation transaction and upgrade the UA to the universal account and then send a conversion.
13:01 One thing that I appreciate of the magic wallet, it's why I pick it for
13:08 this kind of demos and workshops is because it defaults to blind signatures.
13:17 And this is a very big UX improvement. A blind signature is essentially a signature that goes on behind the
13:25 scenes without any popup coming up for the users, nothing to sign. Uh so everything is manual in this specific
13:33 demo but you can essentially automate everything depending on your work or your flow of your how your app
13:43 works because as long as I have some eth on base I can easily automate this delegation and even the transaction
13:51 because the signature goes on automatically right. Um so this address that ends in 24 alpha 53 those this
14:00 one here this is my magic EOA and in this case is also my universal account they become the same address
14:08 right as I mentioned we also include Solana this is the Solana address linked to my
14:16 universal account so how the Solana side works is that because we do support Solana and their assets so when you have
14:24 to interact with Solana where you going to use these others. Let's say that you want to support Solana in your app
14:32 even though your app maybe works mostly on some other EVM chain you can enable at least a deposit through Solana
14:39 because as long as I send solo USDC to this address they are going to reflected in my universal balance. So my universal balance right now is $27.
14:51 And here's my breakdown. I have about 30 cents in ETH on base. I have some USDC on base and I have 0.2 USDC on Solana.
15:05 So these all these assets are different assets and they are even across multiple chains but I only see this one number
15:13 and this is the number that is important right you can show this to your users doesn't matter where the assets are where they come from. you
15:20 can use this across all the chains. For example, in this case I want to run the delegation on base. So because I do
15:29 have some assets on base, I have those 2.43 cents on base. This means that once I delegate it now, I can use those
15:38 assets from base on any chain and that's how we're going to convert them to. So
15:46 so this delegate on base is essentially going to trigger
15:53 this where is it this type four transaction here submit 7702 delegation. Uh there is
16:03 a whole bunch of TypeScript infrastructure and supporting code in here. Uh so it seems relatively complex
16:10 but it really is. Once we sign and submit that once we call submit 7702 delegation
16:18 we fetch the 7702 authorization for base from the universal account.
16:26 Then we sign the authorization specifically with the sign EIP7702
16:32 [authorization] method from the magic wallet and then we send it simply once we
16:41 send it. It has a whole bunch of stuff in here but once we send it this is actually the part that is a little
16:48 bit more that does the heavy lifting.
16:52 Once we send it, then it's going to be included basically when we send a transaction from the universal account.
17:00 This one here and this is what allows us to upgrade the UA. So let's try to run it. In this case, I have some ETH on base. So this
17:10 one should run smoothly unless there is some other error that I didn't consider. Okay, so we have
17:18 delegation successful and I didn't really build anything to refresh automatically here. So if I refresh the page, it should show up as delegated now. Yep.
17:28 Now my EOA on magic is delegated on base.
17:35 This means that my EOA now is a universal account. And as you could see, I clicked the button, but I didn't have to sign anything because of the blind signatures
17:43 that are offered by Magic. Uh this is a very big UX point here because you could automate all of that.
17:52 And now this is the main really the main part of the show. I would say
18:01 we are going to convert some of this USDC that I have on base on some USDC on Solana. So let's do 0.3.
18:10 I do the signature. I send it up and then we can use the universal X explorer
18:16 as usual to see the movements and as you can see
18:25 I sent some USDC on Solana 0 sorry I sent some 0.3 USDC on base from base to Solana
18:35 and I sent it from my EOA 53 to basically my universal account on
18:44 Solana. If you do this on an EVM chain, then those two are going to match, right? Because you're going to just
18:51 transfer between your account. This is a conversion. So, this is how we sourced
18:58 USDC on Solana from the account my already the account that I already have on base.
19:06 And that's it. This is the whole thing.
19:10 As you can see, I do a lot of explanations. I tried to go through a lot of explanations here, but the
19:17 concept is very simple. Uh I even talk too much probably over explaining this.
19:22 The concept is so simple. You have a new EOA, you upgrade it to a universal account and then you use it across the chains that you want. Now, this is
19:30 specifically on base. So, that means that let's say I have other assets. So let's say I have some USDC on arbitrum
19:38 then this movement wouldn't work. You will need to also run the delegation on arbitrum. Um
19:46 and I guess there are ways if you want to try to sponsor the gas maybe directly from using some other kind
19:56 of infrastructure with magic you probably can. That will be an extra point I guess on user experience.
20:05 Um and then the main point of the workshop I guess the main title and description was
20:12 kind of how to abstract the transaction.
20:16 In this case it was nothing wasn't really abstracted because I clicked every single one and it shows steps. Uh
20:25 but with this kind of blind signatures with these embedded wallets you could abstract the whole thing. Right? This is really what I wanted to talk about
20:33 mostly. Um so we have the full repository for this demo
20:41 and it has a very deep and detailed readme. Uh so you can even just take this demo and use it as a starting point for your project if you want to.
20:52 It's pretty much already working that way. Uh I'm going to link the repository in the discord once we are done. And
21:01 that's about it. I would say
21:22 is Dwight Sh still around.
21:27 Sorry, my laptop my laptop quickly died. I just had to boot it back up.
21:31 Perfect. It always helps. so much. I wanted to ask you a question. Um yeah, first like
21:38 does this deal with like or would there ever what like common security headaches do you look
21:47 at when it comes to like these sort of transactions? Because I think that's another thing. I mean that's probably one of the biggest reasons that
21:52 like UX and UI is like I don't want to say awful but quite confusing for
22:00 for crypto sort of projects because you do have I mean look at the numbers on the screen right now. Um you
22:07 know these are important numbers. So how do you go about minimizing these?
22:14 Uh I guess it depends the kind of infrastructure you use. Um, for example, those numbers I have on the screens are not really sensitive at all. Those are
22:22 just my accounts. Um, one of the benefits of using these embedded wallets is that they run the security. Uh so for
22:30 example when I log in with my email magic takes that email and they run
22:38 their own infrastructure in their back end where it takes that email it generates a private key and then it
22:45 handles that private key in their secure environment. Uh so the user really
22:51 never touches the private key and also a possible
22:59 a possible hacker let's say or attacker could not really easily access the private key. Um universal account
23:08 themselves are a smart account so they don't have a private key. Um, and if you really want,
23:16 you could build a you could very easily build an app that doesn't show any blockchain related information at all
23:24 because everything can be automated behind the scenes. Um overall the fact the security factor is generally more
23:34 related to when you use regular RPC wallets because then the user manages the private key and those can be exposed
23:42 or if your application uses some kind of smart contract vaults or other
23:48 infrastructure in their own back end because then those can be affected by
23:56 general the embedded wallets have very high security because
24:02 they do not expose private keys which the private key is really the only
24:10 thing that is that you should worry about really. Um so as long as that one is not exposed and that's for example
24:16 why the particle wallets for particle embedded wallets we can't really use them right now for this kind of
24:26 process because we do not support the method to sign the 7702 authorization but for example there
24:35 is absolutely no way with our embedded wallet to export the private key that the private key is is ever
24:43 built in one location. Uh so it's virtually unhackable. Now if you lose access to your email or someone else has
24:52 access to your email, well then then they can access your wallet. But that level of security now it's with the user really.
25:03 Yeah. Yeah. Um there's a question from the chat. Uh are you able to read the chat?
25:11 Yes. Yes. The question go to the Q&A section. There's a question from
25:20 um that is an interesting question. Uh yes
25:27 uh universal account infrastructure is only on mainet. I know that is annoying especially when you're
25:35 trying to develop stuff for hackathons like this because you need to use real funds. Uh the issue there is that it's very complex infrastructure.
25:44 So it just does not work on test net test nets don't have the right pieces to make it work. Now your
25:53 question says what if we use some virtual net that forks the main net.
26:01 Um I mean if you can make it work that I can try. Yeah I don't see an issue with that. um
26:10 our SDK doesn't have any anything built in for this kind of
26:16 operation but I think I did something similar before just kind of
26:23 forking a mainet with Anvil and the run stuff. So yeah, I think it if you can make it work yeah I don't have a problem with that.
26:32 Nice. Nice. Well, that was compared to the last workshop at least, this was much more intense, but at the
26:40 same time, I think technically very important as well. Um, I want to say big thanks to David, for taking us
26:48 through transaction abstractions. Um, really appreciate you sharing your time and expertise with our cohort from all around the world. Quick
26:56 recap. We saw how sponsored transactions, cleaner signing flows and smarter execution patterns can remove friction and make a dapp feel genuinely
27:04 easy to use. Um I think for you guys doing the hackathon or building your own project look at where transaction
27:12 friction lives in your own project and think about how abstraction could smooth it out. That's exactly the kind of UX that the judges are looking for.
27:22 Looking ahead, this was the first of several UX focused sessions. We've got zero dev on chain abstraction on the 7th of July, openfort and x402 on the 8th of
27:30 July, and magic on social login on the 22nd before the finale and prize giving on the 30th of July. Any follow-up
27:38 questions, bring them to the Discord, the team, and our partners are there to help. Big thanks again to David
27:45 and Particle Network. Thanks to all of you and happy building. Yep. Thank you. Thank you.
27:53 Thank you guys. See you. Bye-bye. Thank you. Bye.
