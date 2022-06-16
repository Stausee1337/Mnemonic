import { FunctionComponent } from "preact";
import styles from "./controls.module.scss";

console.log(styles)

export const Center: FunctionComponent = (props) => 
    <div className={styles.center}>{props.children}</div>;


export const HCenter: FunctionComponent = (props) => 
    <div className={styles['h-center']}>{props.children}</div>


export const SpaceFiller: FunctionComponent = (props) => 
    <div className={styles['space-filler']}>{props.children}</div>;


export const Container: FunctionComponent = (props) => 
    <div style={{display: 'flex'}} >{props.children}</div>;


export const Columns: FunctionComponent = (props) => 
    <div className={styles.columns}>{props.children}</div>


