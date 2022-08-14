import { FunctionComponent } from "preact";
import { StateUpdater, useEffect, useState } from "preact/hooks";
import { Config } from "../config";
import { Checkbox, ContainerBox, ContainerItem, ContainerRow, ExpansionContainer, ExpansionGroup, ToggleSwitch } from "../controls";
import { Icon } from "../icons";
import { Rust } from "../interface";
import { nullOrUndefined } from "../utils";
import { passwordGenerationRulesDefault } from "./generate";
import { PasswordSettings } from "./restore";

function useConfigState<T>(property: Config.LazyProperty, defaultValue: T): [T, StateUpdater<T>] {
    const [state, setState] = useState(defaultValue);

    useEffect(() => {
        property.getOrDefault(defaultValue).then(data => {
            setState(data);
        })
    }, [])

    const updateConfig = (value: T | ((prevState: T) => void)) => {
        if (typeof value === 'function') {
            value = (value as any as (v: T) => T)(state);
        }
        Config.setProperty(property, value);
        setState(value);
    }

    return [
        state,
        updateConfig
    ]
}

export const SettingsPage: FunctionComponent = () => {
    // password generation rules
    const [pgr, setPgr] = useState(passwordGenerationRulesDefault);
    const [autolaunch, setAutolaunch] = useState(false);

    useEffect(() => {
        Config.globalConfig.passwordGenerationRules.getOrDefault(passwordGenerationRulesDefault)
            .then(rules => {
                setPgr(rules);
            });
        
        Rust.autostartRegistryExecuteCommand("Get").then(installed => {
            if (nullOrUndefined(installed)) {
                // todo: call global error handler
                return;
            }
            setAutolaunch(installed!);
        })
    }, [])

    const updateAutolaunch = (newValue: boolean) => {
        Rust.autostartRegistryExecuteCommand(newValue ? "Activate" : "Deactivate").then(error => {
            if (error === true) { // Error Success 
                setAutolaunch(newValue);
            } else if (error === false) { // Minor Error
                // todo: call global error handler;
                return;
            } else { // Major Error
                // todo: call global error handler;
                return;
            }
        })
    }

    const [sos, setSos] = useConfigState(Config.globalConfig.generalApp.showOnStart, false);
    const [aol, setAol] = useConfigState(Config.globalConfig.generatePage.askOnLeave, true);
    const [cob, setCob] = useConfigState(Config.globalConfig.restorePage.closeOnBlur, true);
    const [str, setStr] = useConfigState(Config.globalConfig.generalApp.skipToRetrieve, false);

    return (
        <>
            <h6>Passowrd & Generation</h6>
            <PasswordSettings data={pgr} onChange={setPgr}></PasswordSettings>

            <h6>Miscellaneous</h6>
            <ExpansionGroup>
                <ExpansionContainer expanded
                    heading="General App Settings"
                    description="Edit Preferences which change how the App feels to you, as a user"
                    icon={<Icon name="settings-gear" height={28}/>}>
                        <ContainerItem 
                            label="Bootstrap Mnemonic App when the Computer starts (Launcher)"
                            children={<ToggleSwitch checked={autolaunch} onChanged={updateAutolaunch}/>}/>
                        <ContainerRow>
                            <Checkbox checked={sos} onChanged={setSos} disabled={!autolaunch} children="Launcher: Show Window at Startup"/>
                        </ContainerRow>
                        <ContainerRow>
                            <Checkbox checked={aol} onChanged={setAol} children="Generation Page: Prompt User when Exiting"/>
                        </ContainerRow>
                        <ContainerRow>
                            <Checkbox checked={cob} onChanged={setCob} children="Retrieve Page: Close Window on Blur"/>
                        </ContainerRow>
                        <ContainerRow>
                            <Checkbox checked={str} onChanged={setStr} children="App Startup: Skip to Retrieve Page"/>
                        </ContainerRow>
                </ExpansionContainer>
            </ExpansionGroup>
        </>
    )
}
