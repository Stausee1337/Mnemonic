import { FunctionComponent } from "preact";

import { Center, Box, Header, ExpandableContainer, Button } from '../controls'

export const Guide: FunctionComponent = () => {
    return (
        <>
            <Header>Mnemonic</Header>
            <Center>
                <Box width={60}>
                    <h2 style={{ textAlign: 'center' }}>Welcome</h2>
                    <p>
                        to <strong>Mnemonic</strong> - Password memorizer. We help you remember your password without
                        storing them on your PC.
                    </p>
                    <h3>What's the problem?</h3>
                    <p>
                        In the recent years, internet and cybersecurity have become more and more important.
                        More and more companies but also indiviulas got hacked, which led a increase in cyber security
                        awareness.
                    </p>
                    <p>
                        The most important countermeasure against getting hacked, are long and secure passwords.
                        But the better they are for your personal safety, the worse they become to memorize. Ideally 
                        all your passwords should be stored in a <b>password manager</b>. 
                        But where do you sore the <i>master password</i> then?
                    </p>
                    <ExpandableContainer>
                        <p>
                            A <strong>password manager</strong> is a storage that holds all of your passwords for other websites
                            in one common place and across devices. There are a number of advantages from a password manager compared to simple
                            text-files or offline notebooks. Yet, as mentioned above, all your passwords are protected by <strong>one password</strong>,
                            which will be the weakest point in the system.
                        </p>
                        <p>
                            As all passwords it should be perfectly random, at least 20 characters long and <i>not noticable</i>.
                            So storing it unencrypted on your harddrive isn't the best idea, also having a note in the physical world
                            could be unfortunate, since most password managers don't allow updating the password without entering the proper
                            old one.
                        </p>
                    </ExpandableContainer>
                    <h3>Our solution</h3>
                    <p>
                        Memorizing a string of 12 random characters, happens to be pretty hard for humans. But memorizing 12 
                        uinque words should be way more doable. This technique is called a <strong>Mnemonic</strong> and it
                        helps you memorizing things the easy way. As soon as you hit that generate button in the bottom, the program will give
                        you twelve english words.<br/> E.g.:
                        <blockquote>
                            
                        </blockquote>
                    </p>
                    
                    <div style={{ justifySelf: 'flex-end' }}>
                        <Center>
                            <Button>Generate</Button>
                        </Center>
                    </div>
                </Box>
            </Center>
        </>
    )
}
