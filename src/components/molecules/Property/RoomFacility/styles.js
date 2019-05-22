import { StyleSheet } from 'react-native';
import { getFontSize } from '../../../../utils/designUtils';

const styles = StyleSheet.create({
    container: {
      flexDirection:'column',
      marginLeft: 17.5,
      marginRight: 17.5,
    },

    title:{
      fontFamily: 'futura',
      fontSize: getFontSize(17),
      color: '#000000',
      marginTop: 10,
      marginBottom: 10
    },

    facilities: {
        flexDirection: 'row',
        justifyContent:'space-between'
    },
});

export default styles;
