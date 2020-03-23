import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css'


class Clock extends React.Component{
    constructor(props){
      super(props)
      this.state = {date: new Date()}
    }
  
    componentDidMount(){
      this.timerID = setInterval(
        () => this.tick(), 
        1000
        )
    }
  
    componentWillUnmount(){
      clearInterval(this.timerID);
    }
  
    tick(){
      this.setState({
        date: new Date()
      });
    }
  
    render(){
      return(
        <div style={{padding:10}}>
          <h4>{this.state.date.toLocaleTimeString()}</h4>
        </div>
      );
    }
  }

  export default Clock;